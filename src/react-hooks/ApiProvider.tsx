import { configureStore } from '@reduxjs/toolkit';
import React, { Context } from 'react';
import { Provider, ReactReduxContextValue } from 'react-redux';
import { setupListeners } from '../core/setupListeners';
import { Api } from '../apiTypes';

/**
 * Can be used as a Provider if you **do not have a Redux store**.
 * Using this together with an existing redux store, both will
 * conflict with each other - please use the traditional redux setup
 * in that case.
 */
export function ApiProvider<A extends Api<any, {}, any, any>>(props: {
  children: any;
  api: A;
  setupListeners?: Parameters<typeof setupListeners>[1];
  context?: Context<ReactReduxContextValue>;
}) {
  const [store] = React.useState(() =>
    configureStore({
      reducer: {
        [props.api.reducerPath]: props.api.reducer,
      },
      middleware: (gDM) => gDM().concat(props.api.middleware),
    })
  );
  // Adds the event listeners for online/offline/focus/etc
  setupListeners(store.dispatch, props.setupListeners);

  return (
    <Provider store={store} context={props.context}>
      {props.children}
    </Provider>
  );
}
