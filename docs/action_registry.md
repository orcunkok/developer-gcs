# Action Registry

Single entry point for all commands in the GCS. UI buttons, context menus, console, keyboard shortcuts, and AI skills all go through the same registry.

## Usage

```js
import { action } from "../actions.js";

action.goto({ lat: -35.36, lon: 149.16, alt: 100 });
action.arm();
action.setMode({ mode: "GUIDED" });
```

That's it. No events to emit, no adapter to import. The registry handles logging and routing automatically.

## How it works

1. Call `action.whatever(params)` from anywhere
2. Registry logs it to the event store (`action` event with name + params)
3. Registry calls the registered handler, which sends via the adapter

## Registering actions

Adapters register their own actions. Each adapter knows what commands it supports:

```js
// inside MavlinkAdapter.js
registerActions() {
    const send = (action, params = {}) => this.send({ action, params });
    registerAction("arm", () => send("arm"));
    registerAction("goto", (p) => send("goto", p));
}
```

A different adapter (replay, simulator, custom protocol) registers its own set the same way.

## Adding a new action

1. Add `registerAction("name", handler)` in the adapter
2. Call `action.name(params)` from anywhere
