---
id: mutations
title: Mutations
sidebar_label: Mutations
hide_title: true
---

# Mutations

Unlike `useQuery`, `useMutation` returns a tuple. The first item in the tuple is the `trigger` function and the second element contains an object with `status`, `error`, and `data`.

Unlike the `useQuery` hook, the `useMutation` hook doesn't execute automatically. To run a mutation you have to call the trigger function returned as the first tuple value from the hook.

```js title="Example of all mutation endpoint options"
const api = createApi({
  baseQuery,
  endpoints: (build) => ({
    updatePost: build.mutation({
      query: ({ id, ...patch }) => ({ url: `post/${id}`, method: 'PATCH', body: patch }),
      // Pick out data and prevent nested properties in a hook or selector
      transformResponse: (response) => response.data,
      // onStart, onSuccess, onError are useful for optimistic updates
      // The 2nd parameter is the destructured `mutationApi`
      onStart({ id, ...patch }, { dispatch, getState, extra, requestId, context }) {},
      // `result` is the server response
      onSuccess({ id }, mutationApi, result) {},
      onError({ id }, { dispatch, getState, extra, requestId, context }) {},
      invalidatesTags: ['Post'],
    }),
  }),
});
```

:::info
Notice the `onStart`, `onSuccess`, `onError` methods? Be sure to check out how they can be used for [optimistic updates](./optimistic-updates.md)
:::

### Type interfaces

```ts title="Mutation endpoint definition"
export type MutationDefinition<
  QueryArg,
  BaseQuery extends BaseQueryFn,
  TagTypes extends string,
  ResultType,
  ReducerPath extends string = string,
  Context = Record<string, any>
> = BaseEndpointDefinition<QueryArg, BaseQuery, ResultType> & {
  type: DefinitionType.mutation;
  invalidatesTags?: ResultDescription<TagTypes, ResultType, QueryArg>;
  providesTags?: never;
  onStart?(arg: QueryArg, mutationApi: MutationApi<ReducerPath, Context>): void;
  onError?(
    arg: QueryArg,
    mutationApi: MutationApi<ReducerPath, Context>,
    error: unknown,
    meta: BaseQueryMeta<BaseQuery>
  ): void;
  onSuccess?(
    arg: QueryArg,
    mutationApi: MutationApi<ReducerPath, Context>,
    result: ResultType,
    meta: BaseQueryMeta<BaseQuery> | undefined
  ): void;
};
```

```ts title="MutationApi"
export interface MutationApi<ReducerPath extends string, Context extends {}> {
  dispatch: ThunkDispatch<any, any, AnyAction>;
  getState(): RootState<any, any, ReducerPath>;
  extra: unknown;
  requestId: string;
  context: Context;
}
```

### Basic Mutation

This is a modified version of the complete example you can see at the bottom of the page to highlight the `updatePost` mutation. In this scenario, a post is fetched with `useQuery`, and then a `EditablePostName` component is rendered that allows us to edit the name of the post.

```ts title="src/features/posts/PostDetail.tsx"
export const PostDetail = () => {
  const { id } = useParams<{ id: any }>();

  const { data: post } = useGetPostQuery(id);

  const [
    // highlight-next-line
    updatePost, // This is the mutation trigger
    { isLoading: isUpdating }, // You can use the `isLoading` flag, or do custom logic with `status`
  ] = useUpdatePostMutation();

  return (
    <Box p={4}>
      <EditablePostName
        name={post.name}
        onUpdate={(name) => {
          // If you want to immediately access the result of a mutation, you need to chain `.unwrap()`
          // if you actually want the payload or to catch the error.
          // Example: `updatePost().unwrap().then(fulfilled => console.log(fulfilled)).catch(rejected => console.error(rejected))

          return (
            // highlight-start
            // Execute the trigger with the `id` and updated `name`
            updatePost({ id, name })
            // highlight-end
          );
        }}
        isLoading={isUpdating}
      />
    </Box>
  );
};
```

### Advanced mutations with revalidation

In the real world, it's very common that a developer would want to resync their local data cache with the server after performing a mutation (aka "revalidation"). RTK Query takes a more centralized approach to this and requires you to configure the invalidation behavior in your API service definition. Before getting started, let's cover some new terms used when defining an endpoint in a service:

#### Tags

For RTK Query, _tags_ are just a name that you can give to a specific collection of data to control caching and invalidation behavior, and are defined in an `tagTypes` argument. For example, in an application that has both `Posts` and `Users`, you would define `tagTypes: ['Posts', 'Users']` when calling `createApi`.

#### Provides

A _query_ can _provide_ tags to the cache. The `providesTags` argument can either be an array of `string` (such as `['Posts']`), `{type: string, id?: string|number}` or a callback that returns such an array. That function will be passed the result as the first argument, the response error as the second argument, and the argument originally passed into the `query` method as the third argument. Note that either the result or error arguments may be undefined based on whether the query was successful or not.

#### Invalidates

A _mutation_ can _invalidate_ specific tags in the cache. The `invalidatesTags` argument can either be an array of `string` (such as `['Posts']`), `{type: string, id?: string|number}` or a callback that returns such an array. That function will be passed the result as the first argument, the response error as the second argument, and the argument originally passed into the `query` method as the third argument. Note that either the result or error arguments may be undefined based on whether the mutation was successful or not.

### Scenarios and Behaviors

RTK Query provides _a lot_ of flexibility for how you can manage the invalidation behavior of your service. Let's look at a few different scenarios:

#### Invalidating everything of a type

```ts title="API Definition"
export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  tagTypes: ['Posts'],
  endpoints: (build) => ({
    getPosts: build.query<PostsResponse, void>({
      query: () => 'posts',
      providesTags: (result) => (result ? result.map(({ id }) => ({ type: 'Posts', id })) : ['Posts']),
    }),
    addPost: build.mutation<Post, Partial<Post>>({
      query: (body) => ({
        url: `posts`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Posts'],
    }),
    getPost: build.query<Post, number>({
      query: (id) => `posts/${id}`,
      providesTags: (result, error, id) => [{ type: 'Posts', id }],
    }),
  }),
});

export const { useGetPostsQuery, useGetPostQuery, useAddPostMutation } = api;
```

```ts title="App.tsx"
function App() {
  const { data: posts } = useGetPostsQuery();
  const [addPost] = useAddPostMutation();

  return (
    <div>
      <AddPost onAdd={addPost} />
      <PostsList />
      <PostDetail id={1} /> // Assume each PostDetail is subscribed via `const {data} = useGetPostQuery(id)`
      <PostDetail id={2} />
      <PostDetail id={3} />
    </div>
  );
}
```

**What to expect**

When `addPost` is triggered, it would cause each `PostDetail` component to go back into a `isFetching` state because `addPost` invalidates the root tag, which causes _every query_ that provides 'Posts' to be re-run. In most cases, this may not be what you want to do. Imagine if you had 100 posts on the screen that all subscribed to a `getPost` query – in this case, you'd create 100 requests and send a ton of unnecessary traffic to your server, which we're trying to avoid in the first place! Even though the user would still see the last good cached result and potentially not notice anything other than their browser hiccuping, you still want to avoid this.

#### Selectively invalidating lists

Keep an eye on the `provides` property of `getPosts` - we'll explain why after.

```ts title="API Definition"
export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  tagTypes: ['Posts'],
  endpoints: (build) => ({
    getPosts: build.query<PostsResponse, void>({
      query: () => 'posts',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Posts', id })), { type: 'Posts', id: 'LIST' }]
          : [{ type: 'Posts', id: 'LIST' }],
    }),
    addPost: build.mutation<Post, Partial<Post>>({
      query(body) {
        return {
          url: `posts`,
          method: 'POST',
          body,
        };
      },
      invalidatesTags: [{ type: 'Posts', id: 'LIST' }],
    }),
    getPost: build.query<Post, number>({
      query: (id) => `posts/${id}`,
      providesTags: (result, error, id) => [{ type: 'Posts', id }],
    }),
  }),
});

export const { useGetPostsQuery, useAddPostMutation, useGetPostQuery } = api;
```

> **Note about 'LIST' and `id`s**
>
> 1. `LIST` is an arbitrary string - technically speaking, you could use anything you want here, such as `ALL` or `*`. The important thing when choosing a custom id is to make sure there is no possibility of it colliding with an id that is returned by a query result. If you have unknown ids in your query results and don't want to risk it, you can go with point 3 below.
> 2. You can add _many_ tag types for even more control
>    - `[{ type: 'Posts', id: 'LIST' }, { type: 'Posts', id: 'SVELTE_POSTS' }, { type: 'Posts', id: 'REACT_POSTS' }]`
> 3. If the concept of using an `id` like 'LIST' seems strange to you, you can always add another `tagType` and invalidate it's root, but we recommend using the `id` approach as shown.

```ts title="App.tsx"
function App() {
  const { data: posts } = useGetPostsQuery();
  const [addPost] = useAddPostMutation();

  return (
    <div>
      <AddPost onAdd={addPost} />
      <PostsList />
      <PostDetail id={1} /> // Assume each PostDetail is subscribed via `const {data} = useGetPostQuery(id)`
      <PostDetail id={2} />
      <PostDetail id={3} />
    </div>
  );
}
```

**What to expect**

When `addPost` is fired, it will only cause the `PostsList` to go into an `isFetching` state because `addPost` only invalidates the 'LIST' id, which causes `getPosts` to rerun (because it provides that specific id). So in your network tab, you would only see 1 new request fire for `GET /posts`. Once that resolves and assuming it returned updated data for ids 1, 2, and 3, the `PostDetail` components would then rerender with the latest data.

### Commented Posts Service

This is an example of a [CRUD service](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) for Posts. This implements the [Selectively invalidating lists](#selectively-invalidating-lists) strategy and will most likely serve as a good foundation for real applications.

```ts title="src/app/services/posts.ts"
// Or from '@rtk-incubator/rtk-query/react'
import { createApi, fetchBaseQuery } from '@rtk-incubator/rtk-query';

export interface Post {
  id: number;
  name: string;
}

type PostsResponse = Post[];

export const postApi = createApi({
  reducerPath: 'postsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  tagTypes: ['Posts'],
  endpoints: (build) => ({
    getPosts: build.query<PostsResponse, void>({
      query: () => 'posts',
      // Provides a list of `Posts` by `id`.
      // If any mutation is executed that `invalidate`s any of these tags, this query will re-run to be always up-to-date.
      // The `LIST` id is a "virtual id" we just made up to be able to invalidate this query specifically if a new `Posts` element was added.
      providesTags: (result) =>
        // is result available?
        result
          ? // successful query
            [...result.map(({ id }) => ({ type: 'Posts', id })), { type: 'Posts', id: 'LIST' }]
          : // an error occurred, but we still want to refetch this query when `{ type: 'Posts', id: 'LIST' }` is invalidated
            [{ type: 'Posts', id: 'LIST' }],
    }),
    addPost: build.mutation<Post, Partial<Post>>({
      query(body) {
        return {
          url: `posts`,
          method: 'POST',
          body,
        };
      },
      // Invalidates all Post-type queries providing the `LIST` id - after all, depending of the sort order,
      // that newly created post could show up in any lists.
      invalidatesTags: [{ type: 'Posts', id: 'LIST' }],
    }),
    getPost: build.query<Post, number>({
      query: (id) => `posts/${id}`,
      providesTags: (result, error, id) => [{ type: 'Posts', id }],
    }),
    updatePost: build.mutation<Post, Partial<Post>>({
      query(data) {
        const { id, ...body } = data;
        return {
          url: `posts/${id}`,
          method: 'PUT',
          body,
        };
      },
      // Invalidates all queries that subscribe to this Post `id` only.
      // In this case, `getPost` will be re-run. `getPosts` *might*  rerun, if this id was under it's results.
      invalidatesTags: (result, error, { id }) => [{ type: 'Posts', id }],
    }),
    deletePost: build.mutation<{ success: boolean; id: number }, number>({
      query(id) {
        return {
          url: `posts/${id}`,
          method: 'DELETE',
        };
      },
      // Invalidates all queries that subscribe to this Post `id` only.
      invalidatesTags: (result, error, id) => [{ type: 'Posts', id }],
    }),
  }),
});

export const {
  useGetPostsQuery,
  useAddPostMutation,
  useGetPostQuery,
  useUpdatePostMutation,
  useDeletePostMutation,
} = api;
```

### Example

<iframe src="https://codesandbox.io/embed/concepts-mutations-4d98s?fontsize=14&hidenavigation=1&module=%2Fsrc%2Fapp%2Fservices%2Fposts.ts&theme=dark"
     style={{ width: '100%', height: '600px', border: 0, borderRadius: '4px', overflow: 'hidden' }}
     title="RTK Query - Mutations Concept"
     allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb" 
     sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
></iframe>
