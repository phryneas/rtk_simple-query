import { configureStore } from '@reduxjs/toolkit';
import { createApi, dummyBaseQuery } from '@rtk-incubator/rtk-query';

type CustomErrorType = { type: 'Custom' };

const api = createApi({
  baseQuery: dummyBaseQuery<CustomErrorType>(),
  endpoints: (build) => ({
    withQuery: build.query<string, string>({
      // @ts-expect-error
      query(arg: string) {
        return `resultFrom(${arg})`;
      },
      // @ts-expect-error
      transformResponse(response) {
        return response.wrappedByBaseQuery;
      },
    }),
    withQueryFn: build.query<string, string>({
      queryFn(arg: string) {
        return { data: `resultFrom(${arg})` };
      },
    }),
    withInvalidDataQueryFn: build.query<string, string>({
      // @ts-expect-error
      queryFn(arg: string) {
        return { data: 5 };
      },
    }),
    withErrorQueryFn: build.query<string, string>({
      queryFn(arg: string) {
        return { error: { type: 'Custom' } };
      },
    }),
    withInvalidErrorQueryFn: build.query<string, string>({
      // @ts-expect-error
      queryFn(arg: string) {
        return { error: 5 };
      },
    }),
    withAsyncQueryFn: build.query<string, string>({
      async queryFn(arg: string) {
        return { data: `resultFrom(${arg})` };
      },
    }),
    withInvalidDataAsyncQueryFn: build.query<string, string>({
      // @ts-expect-error
      async queryFn(arg: string) {
        return { data: 5 };
      },
    }),
    withAsyncErrorQueryFn: build.query<string, string>({
      async queryFn(arg: string) {
        return { error: { type: 'Custom' } };
      },
    }),
    withInvalidAsyncErrorQueryFn: build.query<string, string>({
      // @ts-expect-error
      async queryFn(arg: string) {
        return { error: 5 };
      },
    }),

    mutationWithQueryFn: build.mutation<string, string>({
      queryFn(arg: string) {
        return { data: `resultFrom(${arg})` };
      },
    }),
    mutationWithInvalidDataQueryFn: build.mutation<string, string>({
      // @ts-expect-error
      queryFn(arg: string) {
        return { data: 5 };
      },
    }),
    mutationWithErrorQueryFn: build.mutation<string, string>({
      queryFn(arg: string) {
        return { error: { type: 'Custom' } };
      },
    }),
    mutationWithInvalidErrorQueryFn: build.mutation<string, string>({
      // @ts-expect-error
      queryFn(arg: string) {
        return { error: 5 };
      },
    }),

    mutationWithAsyncQueryFn: build.mutation<string, string>({
      async queryFn(arg: string) {
        return { data: `resultFrom(${arg})` };
      },
    }),
    mutationWithInvalidAsyncQueryFn: build.mutation<string, string>({
      // @ts-expect-error
      async queryFn(arg: string) {
        return { data: 5 };
      },
    }),
    mutationWithAsyncErrorQueryFn: build.mutation<string, string>({
      async queryFn(arg: string) {
        return { error: { type: 'Custom' } };
      },
    }),
    mutationWithInvalidAsyncErrorQueryFn: build.mutation<string, string>({
      // @ts-expect-error
      async queryFn(arg: string) {
        return { error: 5 };
      },
    }),
    // @ts-expect-error
    withNeither: build.query<string, string>({}),
    // @ts-expect-error
    mutationWithNeither: build.mutation<string, string>({}),
  }),
});

const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
  },
  middleware: (gDM) => gDM({}).concat(api.middleware),
});

test('dummyBaseQuery throws when invoking query', async () => {
  const thunk = api.endpoints.withQuery.initiate('');
  const result = await store.dispatch(thunk);
  expect(result.error).toEqual({
    message: 'When using `dummyBaseQuery`, all queries & mutations have to use the `queryFn` definition syntax.',
    name: 'Error',
    stack: expect.any(String),
  });
});
