---
id: conditional-fetching
title: Conditional Fetching
sidebar_label: Conditional Fetching
hide_title: true
---

# `Conditional Fetching`

If you want to prevent a query from automatically running, you can use the `skip` parameter in a hook.

```ts title="Skip example"
const Pokemon = ({ name, skip }: { name: string; skip: boolean }) => {
  const { data, error, status } = hooks.getPokemonByName.useQuery(name, {
    skip,
  });

  return (
    <div>
      {name} - {status}
    </div>
  );
};
```

When `skip` is `true`:

- **If the query has cached data:**
  - The cached data **will not be used** on the initial load, and will ignore updates from any identical query until the `skip` condition is removed
  - The query will have a status of `uninitialized`
  - If a `skip: false` is set after skipping the initial load, we will use the cached result
- **If the query does not have cached data**
  - The query will have a status of `uninitialized`
  - The query will not exist in the state when viewed with the dev tools
  - The query will not automatically fetch on mount
  - The query will not automatically run when additional components with the same query are added that do run

### Example

<iframe
  src="https://codesandbox.io/embed/concepts-conditional-fetching-tdrz9?fontsize=14&hidenavigation=1&theme=dark"
  style={{ width: '100%', height: '600px', border: 0, borderRadius: '4px', overflow: 'hidden' }}
  title="rtk-query-react-hooks-example"
  allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb"
  sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
></iframe>
