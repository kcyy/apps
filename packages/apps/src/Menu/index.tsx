// Copyright 2017-2020 @polkadot/apps authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Route, Routes } from '@polkadot/apps-routing/types';
import { ApiProps } from '@polkadot/react-api/types';
import { ThemeProps } from '@polkadot/react-components/types';
import { AccountId } from '@polkadot/types/interfaces';
import { Group, Groups, ItemRoute } from './types';

import { TFunction } from 'i18next';
import React, { useMemo, useRef } from 'react';
import styled from 'styled-components';
import createRoutes from '@polkadot/apps-routing';
import { useAccounts, useApi, useCall } from '@polkadot/react-hooks';

import { findMissingApis } from '../endpoint';
import { useTranslation } from '../translate';
import ChainInfo from './ChainInfo';
import Grouping from './Grouping';
import Item from './Item';
import NodeInfo from './NodeInfo';

interface Props {
  className?: string;
}

const disabledLog = new Map<string, string>();

function createExternals (t: TFunction): ItemRoute[] {
  return [
    { href: 'https://github.com/polkadot-js/apps', icon: 'code-branch', name: 'github', text: t<string>('nav.github', 'GitHub', { ns: 'apps-routing' }) },
    { href: 'https://wiki.polkadot.network', icon: 'book', name: 'wiki', text: t<string>('nav.wiki', 'Wiki', { ns: 'apps-routing' }) }
  ];
}

function logDisabled (route: string, message: string): void {
  if (!disabledLog.get(route)) {
    disabledLog.set(route, message);

    console.warn(`Disabling ${route}: ${message}`);
  }
}

function checkVisible (name: string, { api, isApiConnected, isApiReady }: ApiProps, hasAccounts: boolean, hasSudo: boolean, { isHidden, needsAccounts, needsApi, needsSudo }: Route['display']): boolean {
  if (name === 'settings') return false;

  if (isHidden) {
    return false;
  } else if (needsAccounts && !hasAccounts) {
    return false;
  } else if (!needsApi) {
    return true;
  } else if (!isApiReady || !isApiConnected) {
    return false;
  } else if (needsSudo && !hasSudo) {
    logDisabled(name, 'Sudo key not available');

    return false;
  }

  const notFound = findMissingApis(api, needsApi);

  if (notFound.length !== 0) {
    logDisabled(name, `API not available: ${notFound.toString()}`);
  }

  return notFound.length === 0;
}


function extractGroups (routing: Routes, groupNames: Record<string, string>, apiProps: ApiProps, hasAccounts: boolean, hasSudo: boolean): Group[] {
  return Object
    .values(
      routing.reduce((all: Groups, route): Groups => {
        if (!all[route.group]) {
          all[route.group] = { name: groupNames[route.group], routes: [route] };
        } else {
          all[route.group].routes.push(route);
        }

        return all;
      }, {})
    )
    .map(({ name, routes }): Group => ({
      name,
      routes: routes.filter(({ display, name }) => checkVisible(name, apiProps, hasAccounts, hasSudo, display))
    }))
    .filter(({ routes }) => routes.length);
}

function extractSettingsRoute (routing: Routes): Route | undefined {
  return routing.find((route) => route.name === 'settings');
}

function Menu ({ className = '' }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { allAccounts, hasAccounts } = useAccounts();
  const apiProps = useApi();
  const sudoKey = useCall<AccountId>(apiProps.isApiReady && apiProps.api.query.sudo?.key);

  const externalRef = useRef(createExternals(t));

  const groupRef = useRef({
    accounts: t('Accounts'),
    developer: t('Developer'),
    governance: t('Governance'),
    network: t('Network')
  });

  const routeRef = useRef(createRoutes(t));

  const settingsRoute = extractSettingsRoute(routeRef.current);

  const hasSudo = useMemo(
    () => !!sudoKey && allAccounts.some((address) => sudoKey.eq(address)),
    [allAccounts, sudoKey]
  );

  const visibleGroups = useMemo(
    () => extractGroups(routeRef.current, groupRef.current, apiProps, hasAccounts, hasSudo),
    [apiProps, hasAccounts, hasSudo]
  );

  const isLoading = !apiProps.isApiReady || !apiProps.isApiConnected;

  return (
    <div className={`${className}${isLoading ? ' isLoading' : ''} highlight--bg`}>
      <div className='menuSection'>
        <ChainInfo />
        <ul className='menuItems'>
          {visibleGroups.map(({ name, routes }): React.ReactNode => (
            <Grouping
              key={name}
              name={name}
              routes={routes}
            />
          ))}
        </ul>
      </div>
      <div className='menuSection media--1200 centered right'>
        <ul className='menuItems'>
          <Item
            className='menuRight'
            isToplevel
            route={settingsRoute}
          />
          {externalRef.current.map((route): React.ReactNode => (
            <Item
              className='menuRight'
              isToplevel
              key={route.name}
              route={route}
            />
          ))}
        </ul>
      </div>
      <NodeInfo />
    </div>
  );
}

export default React.memo(styled(Menu)(({ theme }: ThemeProps) => `
  align-items: center;
  display: flex;
  padding: 0;
  z-index: 220;
  font-family: 'Nunito Sans',sans-serif;

  &.isLoading {
    background: #999 !important;

    .menuActive {
      background: ${theme.bgPage};
    }

    &:before {
      filter: grayscale(1);
    }

    .menuActive::before {
      background: #f5f3f1;
    }

    .menuItems {
      filter: grayscale(1);
    }
  }

  .menuSection {
    align-items: center;
    align-self: flex-end;
    display: flex;
  }

  .centered {
    margin: auto 0;
  }

  .menuSection.right {
    margin-left: auto;
    margin-right: 2.42rem;

    .menuItems {
      & > li a {
        padding: 0;
      }
    }
  }

  .menuItems {
    flex: 1 1;
    list-style: none;
    padding: 0;
    margin: 0;
    font-weight: 600;

    > li {
      display: inline-block;
    }

    > li:not(:first-child) {
      margin-left: 1.78rem;
    }
  }
`));
