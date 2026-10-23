import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let ReactorSimulation;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  ({ ReactorSimulation } = await vite.ssrLoadModule('/src/simulation/reactor-model.ts'));
});

after(async () => { await vite?.close(); });

function advance(simulation, seconds) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) simulation.update(Math.min(0.05, seconds - elapsed));
}

test('cold shutdown, rod response, thermal response, and manual SCRAM', () => {
  const simulation = new ReactorSimulation();
  assert.equal(simulation.snapshot.mode, 'COLD SHUTDOWN');
  assert.equal(simulation.snapshot.powerPct, 0);

  simulation.setRodTarget(35);
  advance(simulation, 30);
  const operating = simulation.snapshot;
  assert.ok(operating.powerPct > 35 && operating.powerPct < 70, `unexpected power ${operating.powerPct}`);
  assert.ok(operating.coreTemperatureC > 25, 'core did not warm under power');
  assert.ok(operating.primaryPressureMpa > 0.12, 'primary pressure did not respond');
  assert.ok(operating.steamPressureMpa > 0.1, 'steam pressure did not respond');

  simulation.scram();
  advance(simulation, 10);
  const tripped = simulation.snapshot;
  assert.equal(tripped.scramActive, true);
  assert.equal(tripped.emergencyEffect, 0.72);
  assert.equal(tripped.mode, 'SCRAM / DECAY HEAT');
  assert.ok(tripped.powerPct < operating.powerPct, 'SCRAM did not reduce fission power');
  assert.ok(tripped.decayHeatPct > 0, 'decay heat was not represented after SCRAM');
  assert.equal(tripped.alarms[0]?.severity, 'critical');
});

test('low coolant flow at power causes automatic trip and safe reset is interlocked', () => {
  const simulation = new ReactorSimulation();
  simulation.setRodTarget(35);
  simulation.setCoolantFlowTarget(0);
  advance(simulation, 3.2);
  const tripped = simulation.snapshot;
  assert.equal(tripped.scramActive, true);
  assert.equal(tripped.scramCause, 'LOSS OF PRIMARY COOLANT FLOW');
  assert.ok(tripped.emergencyEffect > 0);
  assert.equal(simulation.resetTrip(), false, 'unsafe trip reset should be rejected');

  simulation.setCoolantFlowTarget(100);
  advance(simulation, 300);
  assert.equal(simulation.resetTrip(), true, 'safe cold-shutdown reset should be accepted');
  assert.equal(simulation.snapshot.scramActive, false);
  assert.equal(simulation.snapshot.emergencyEffect, 0);
});

test('reactor state survives serialization and restore', () => {
  const simulation = new ReactorSimulation();
  simulation.setRodTarget(45);
  simulation.setCoolantFlowTarget(83);
  simulation.setFeedwaterFlowTarget(67);
  advance(simulation, 12);
  simulation.scram('TEST TRIP');
  advance(simulation, 3);
  const before = simulation.snapshot;
  const restored = new ReactorSimulation();
  restored.restore(simulation.serialize());
  const afterRestore = restored.snapshot;
  assert.equal(afterRestore.scramActive, true);
  assert.equal(afterRestore.scramCause, 'TEST TRIP');
  assert.equal(afterRestore.tripCount, before.tripCount);
  assert.equal(afterRestore.targetCoolantFlowPct, before.targetCoolantFlowPct);
  assert.equal(afterRestore.targetFeedwaterFlowPct, before.targetFeedwaterFlowPct);
  assert.ok(Math.abs(afterRestore.powerPct - before.powerPct) < 1e-9);
  assert.ok(Math.abs(afterRestore.coreTemperatureC - before.coreTemperatureC) < 1e-9);
});
