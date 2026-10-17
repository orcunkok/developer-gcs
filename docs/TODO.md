# TODO

## Link / MAVLink
- [ ] Connect UI: pick UDP listen port / TCP host:port per link and hand it to `useMavlink` (nothing connects yet)
- [ ] UDP/TCP outside `bun run dev`: the bridge lives in the Vite dev server only; desktop app (native sockets) and production web need their own
- [ ] TCP reconnect when SITL / the vehicle restarts
- [ ] IPv6 for UDP
- [ ] WebSerial for USB flight controllers and telemetry radios
- [ ] Send GCS `HEARTBEAT` at 1 Hz (autopilot GCS failsafe depends on it)
- [ ] Request stream rates with `SET_MESSAGE_INTERVAL`
- [ ] Handle `COMMAND_ACK`: command accepted / rejected / timed out
- [ ] Drop or mark vehicles that go silent (link timeout)
- [ ] Verify MAVLink 2 signatures (signed frames are accepted unchecked)
- [ ] Non-autopilot components (gimbal, companion computer)
- [ ] Multiple batteries per vehicle (`BATTERY_STATUS`)
- [ ] Flight mode in `state` (`HEARTBEAT.custom_mode` decodes differently for ArduPilot and PX4)
- [ ] Sensor health in `status` (`SYS_STATUS` sensor bitmasks), once something displays it

## Map
- [ ] three.js custom layer for 3D visuals: aircraft models, altitude trails, drop lines, waypoints at height
- [ ] Boxes / volumes at altitude with `fill-extrusion`
- [ ] Clicking 3D objects (raycasting)

## Test
- [ ] Fake drones speaking MAVLink bytes through `useMavlink`, so the codec runs in test mode
- [ ] VTOL and plane models next to `testFPV.js`
- [ ] Swarm collision avoidance for `swarm.goto`

## Performance
- [ ] If telemetry-rate re-renders show up in profiling, throttle in the display widget, not in the store
