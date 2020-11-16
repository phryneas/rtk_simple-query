---
id: polling
title: Polling
sidebar_label: Polling / Automatic Refetching
hide_title: true
---

# `Polling`

Polling gives you the ability to have a 'real-time' effect by causing a query to run at a specified interval. To enable polling for a query, pass a `pollingInterval` to the `useQuery` hook or action creator with an interval in milliseconds:

```ts title="src/Pokemon.tsx"
import * as React from "react";
import { hooks } from "./services/pokemon";

export const Pokemon = ({ name }: { name: string }) => {
  // Automatically refetch every 3s
  const { data, status, error, refetch } = hooks.getPokemonByName.useQuery(
    name,
    { pollingInterval: 3000 }
  );

  return (
    <div>
        {JSON.stringify(data)}
    </div>
  );
};
```

In an action creator without React Hooks:

```ts
const { data, status, error, refetch } = store.dispatch(actions.getCountById(id, { subscriptionOptions: { pollingInterval: 3000}}))
```
:::note Usage without React Hooks
If you use polling without the convenience of React Hooks, you will need to manually call `updateSubscriptionOptions` on the promise ref to update the interval. This approach varies by framework but is possible everywhere. See the [Svelte Example](../examples/svelte) for one possibility.
:::

```ts
queryRef.updateSubscriptionOptions({ pollingInterval: 0 });
```

### Example

<iframe src="https://codesandbox.io/embed/concepts-polling-gorpg?fontsize=14&hidenavigation=1&theme=dark"
     style={{ width: '100%', height: '600px', border: 0, borderRadius: '4px', overflow: 'hidden' }}
     title="rtk-query-react-hooks-example"
     allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb" 
     sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
></iframe>
