import  { Auth0Client } from "@auth0/auth0-spa-js";

import PedigreeEditor from './script/pedigree';
import "babel-polyfill";

import '@fortawesome/fontawesome-free/js/fontawesome'
import '@fortawesome/fontawesome-free/js/solid'

import '../public/vendor/xwiki/xwiki-min.css';
import '../public/vendor/xwiki/fullScreen.css';
import '../public/vendor/xwiki/colibri.css';
import '../public/vendor/phenotips/Widgets.css';
import '../public/vendor/phenotips/DateTimePicker.css';
import '../public/vendor/phenotips/Skin.css';

document.observe('dom:loaded', async function () {
  let auth0 = null;

  const configureAuth0 = async () => {
    auth0 = await new Auth0Client({
      domain: process.env.AUTH_0_DOMAIN_URL,
      client_id: process.env.AUTH_0_CLIENT_ID,
      audience: process.env.AUTH_0_AUDIENCE,
    });
  };

  await configureAuth0();

  const authenticated = await auth0.isAuthenticated();
  const login = async () => {
    await auth0.loginWithRedirect({
      redirect_uri: window.location.href
    });
  };
  
  if (!authenticated) {
    const query = new URLSearchParams(window.location.search);
    if (query.has('code') && query.has('state')) {
      await auth0.handleRedirectCallback();
    } else {
      login();
    }
  }

  const graphql = async (body) => {
    const token = await auth0.getTokenSilently();

    const result = await fetch(process.env.HASURA_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body)
    }).then(r => r.json());

    return result;
  };
    
  const urlParams = new URLSearchParams(window.location.search);
  
  const editor = new PedigreeEditor({
    returnUrl: 'javascript:history.go(-2)',
    autosave: true,
    backend: {
      load: async ({ onSuccess, onError }) => {
        if (urlParams.has('phenopacket_id')) {
          const query = `
            query GetOpenPedigreeData($phenopacketId: uuid!) {
              openPedigreeData: open_pedigree_data(where: {phenopacket_id: {_eq: $phenopacketId}}) {
                id
                rawData: raw_data
              }
            }
          `;
          const variables = {
            phenopacketId: urlParams.get('phenopacket_id')
          };
          const result = await graphql({
            query,
            variables
          });

          return onSuccess(
            result?.data?.openPedigreeData[0]?.rawData?.jsonData ?? null
          );
        } else {
          console.warn('No phenopacket ID has been specified. No data will be saved.')
        }
      },
      save: async ({ jsonData, svgData, setSaveInProgress }) => {
        //setSaveInProgress(true);
        const query = `
          mutation UpdateOpenPedigreeData(
            $phenopacketId: uuid!,
            $rawData: jsonb!
          ) {
            insert_family_one(
              object: {
                phenopacket_id: $phenopacketId,
                raw_open_pedigree_data: $rawData
              },
              on_conflict: {
                constraint: family_phenopacket_id_key,
                update_columns: raw_open_pedigree_data
              }
            ) {
              id
            }
          }
        `;
        const variables = {
          phenopacketId: urlParams.get('phenopacket_id'),
          rawData: {
            svgData,
            jsonData,
          },
        };
        const result = await graphql({query, variables});
        //setSaveInProgress(false);
      },
    } 
  });
});
