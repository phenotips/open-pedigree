# Configuring Terminology in Open-Pedigree

A new system to allow more options for terminology usage has been added to open-pedigree.

The fields that use the terminology are disorders, genes and phenotypic features which appear on the
clinical tab of a person node. Each of these can be configured with a terminology which will
do autocomplete search of a terminology.

To configure the terminologies, options should be passed into creation of the pedigree editor.

For example app.js could be changed to :

```javascript

editor = new PedigreeEditor({
    'disorderOptions': {
      'type': 'FHIR',
      'validIdRegex': /\d+/,
      'fhirBaseUrl': 'https://r4.ontoserver.csiro.au/fhir',
      'valueSet': 'http://snomed.info/sct?fhir_vs=refset/32570581000036105'
    },
    'phenotypeOptions': {
      'type': 'FHIR',
      'validIdRegex': /^(http:\/\/)|(HP:)/,
      'fhirBaseUrl': 'https://r4.ontoserver.csiro.au/fhir/',
      'valueSet':  'http://purl.obolibrary.org/obo/hp.fhir?vs'
    },
    'geneOptions': {
      'type': 'FHIR',
      'validIdRegex': /^HGNC:/,
      'fhirBaseUrl': 'https://r4.ontoserver.csiro.au/fhir',
      'valueSet':  'http://www.genenames.org/geneId?vs'
    },
    'fhirTerminologyHelperOptions': {
      'disorderCodeSystem': 'http://snomed.info/sct',
      'phenotypeCodeSystem': 'http://purl.obolibrary.org/obo/hp.fhir',
      'geneCodeSystem': 'http://www.genenames.org/geneId'
    }
  });
```

This will configure the system to use a FHIR based terminology server to query for terms using different valuesets.

For each of the three fields the options objects may include either an object which extends/for-fills the interface
found in src/script/terminology/abstractTerminology.js or an options subobject which contains data for creation of
a known terminology.
For example, using `disorderTerminology` in the options object requires passing an already created terminology, while
using `disorderOptions` tells the system to build a new terminology using the options objects.

The following Terminology types are currently supports:
 - ***CTSS*** - This terminology is based on the original code and should support using a phenotips server.
 - ***FHIR*** - This terminology will use a FHIR based terminology server to do lookups. The terminology does not yet
   support authenticated FHIR terminology servers using client credentials OAuth2 flow.
 - ***Bioportal*** - This terminology allows the use of Bioportal api to query a terminology.
 - ***Static*** - This terminology is initialised with a known static set of terminology terms and uses the sifter 
   javascript library to support searching.
 - ***Delegating*** - This terminology is a generic AJAX terminology where you pass in a function to build the query url
   as well as a function for processing the response to extract the terms.
 - ***Empty*** - This terminology is for when you don't wish to use a terminology.

Each terminology type has its own set of options that need to be set to configure the terminology.

### CTSS Terminology
A CTSS Terminology is created when a type of `CTSS` is provided in the terminology options.

The following options fields are used to configure CTSS terminology:
 - ***validIdRegex*** - A RegEx object that can test if a terms code would be considered valid. If not provided the 
   default value of `/.+/` will be used.
 - ***searchCount*** - How many results to return when doing a search. If not provided the default value of 20 is used.
 - ***ctssBaseUrl*** - The base url to use for fetching the data
 - ***valueColumn*** - The column used for the id of the term.
 - ***textColumn*** - The column used for the name of the term.

This is an example of using the terminology (this is the default used in the system for disorders).
```javascript
'disorderOptions': {
    'type' : 'CTSS',
    'ctssBaseUrl' : new XWiki.Document('OmimService', 'PhenoTips').getURL('get', 'outputSyntax=plain'),
    'valueColumn' : 'id',
    'textColumn' : 'name'
},
```

### FHIR Terminology
A FHIR Terminology is created when a type of `FHIR` is provided in the terminology options.

The following options fields are used to configure FHIR terminology:
- ***validIdRegex*** - A RegEx object that can test if a terms code would be considered valid. If not provided the
  default value of `/.+/` will be used.
- ***searchCount*** - How many results to return when doing a search. If not provided the default value of 20 is used.
- ***fhirBaseUrl*** - The base FHIR url, for example 'https://r4.ontoserver.csiro.au/fhir'. The url should not include
  a trailing '/'.
- ***codesystem*** - The code system to use to lookup terms in ther terminoogy.
- ***valueSet*** - The FHIR valueset URL to use. 
- ***lookupAjaxOptions*** - Options object to be included when making the ajax call for a lookup operation. Lookup takes
  place when loading an existing pedigree. For example `{method: 'POST'}` could be used to make a POST operation be used
  in place of the normal GET. If you overwrite `onSuccess`, `onError` or `onComplete` this will cause the existing
  callbacks to be replaced and things may break.
- ***searchAjaxOptions*** - Options object to be included when making the ajax call for a search operation. Search takes
  place when autocompleting input. For example `{method: 'POST'}` could be used to make a POST operation be used
  in place of the normal GET. If you overwrite `onSuccess`, `onError` or `onComplete` this will cause the existing
  callbacks to be replaced and things may break.

This is an example of using a FHIR terminology:
```javascript
'disorderOptions': {
  'type': 'FHIR',
  'validIdRegex': /\d+/,
  'fhirBaseUrl': 'https://r4.ontoserver.csiro.au/fhir',
  'codeSystem': 'http://snomed.info/sct',
  'valueSet': 'http://snomed.info/sct?fhir_vs=refset/32570581000036105'
},
```
### Bioportal Terminology
A Bioportal Terminology is created when a type of `Bioportal` is provided in the terminology options.

The following options fields are used to configure Bioportal terminology:
- ***validIdRegex*** - A RegEx object that can test if a terms code would be considered valid. If not provided the
  default value of `/.+/` will be used.
- ***searchCount*** - How many results to return when doing a search. If not provided the default value of 20 is used.
- ***bioportalBaseUrl*** - The bioportal base url. This is normally `https://data.bioontology.org`
- ***ontology*** - The bioportal ontology to search. You can find the list of bioportal ontologies at 
  https://bioportal.bioontology.org/
- ***apiKey*** - The bioportal apikey to use when making requests. This could be not provided and instead use the
  ajaxOptions fields to pass the api key in the headers.
- ***lookupAjaxOptions*** - Options object to be included when making the ajax call for a lookup operation. Lookup takes
  place when loading an existing pedigree. For example `{method: 'POST'}` could be used to make a POST operation be used
  in place of the normal GET. If you overwrite `onSuccess`, `onError` or `onComplete` this will cause the existing
  callbacks to be replaced and things may break. If you would prefer to send the apiKey in the headers then as query
  parameters, this field could be set to `{requestHeaders: {'X-Requested-With': null,'X-Prototype-Version': null, 'Authorization': 'apikey token=<your_apikey>'}}`
  }.
- ***searchAjaxOptions*** - Options object to be included when making the ajax call for a search operation. Search takes
  place when autocompleting input. For example `{method: 'POST'}` could be used to make a POST operation be used
  in place of the normal GET. If you overwrite `onSuccess`, `onError` or `onComplete` this will cause the existing
  callbacks to be replaced and things may break.  If you would prefer to send the apiKey in the headers then as query
  parameters, this field could be set to `{requestHeaders: {'X-Requested-With': null,'X-Prototype-Version': null, 'Authorization': 'apikey token=<your_apikey>'}}`
  }.

This is an example of using a Bioportal terminology:
```javascript
    'phenotypeOptions': {
      'type': 'Bioportal',
      'validIdRegex': /^(http:\/\/)|(HP:)/,
      'bioportalBaseUrl': 'https://data.bioontology.org',
      'ontology': 'HP',
      'apiKey':  '<your_apikey>'
    },
```
### Static Terminology
A Static Terminology is created when a type of `Static` is provided in the terminology options.

The following options fields are used to configure Static terminology:
- ***validIdRegex*** - A RegEx object that can test if a terms code would be considered valid. If not provided the
  default value of `/.+/` will be used.
- ***searchCount*** - How many results to return when doing a search. If not provided the default value of 20 is used.
- ***terms*** - The terms in the terminology as an array of objects with a 'value' and 'text' field.

This is an example of using a Static terminology:
```javascript
'disorderOptions': {
  'type': 'Static',
    'terms':  [
    { 'value': 'HD', 'text': 'Heart Defect' },
    { 'value': 'BN', 'text': 'Big Nose' },
  ]
}
```

### Delegating Terminology
A Delegating Terminology is created when a type of `Delegating` is provided in the terminology options.

The following options fields are used to configure Delegating terminology:
- ***validIdRegex*** - A RegEx object that can test if a terms code would be considered valid. If not provided the
  default value of `/.+/` will be used.
- ***searchCount*** - How many results to return when doing a search. If not provided the default value of 20 is used.
- ***lookupUrlFn*** - A function which takes the id being looked up as a parameter and returns a url which will be used
  to lookup a term.
- ***processLookupResponseFn*** - A function which takes the response returned from the lookup endpoint and returns a
  string which represents the name for the term. If the term is not found the function should throw an exception.
- ***lookupAjaxOptionsFn*** - Function to return ajax options for lookup function.
- ***searchUrlFn*** - A function which takes a search string as a parameter and returns a url which will be used
  to search for terms.
- ***processSearchResonseFn*** - A function which takes the response returned from the search endpoint and returns a
  an array of term objects containing a 'value' and 'text' field.
- ***searchAjaxOptionsFn*** - Function to return ajax options for search function 


This is an example of using a Delegating terminology:
```javascript
'disorderOptions': {
  'type': 'Delegating',
  'lookupUrlFn':  (id) => 'https://r4.ontoserver.csiro.au/fhir/CodeSystem/$lookup?_format=json&code=' + id + '&system=http://snomed.info/sct',
  'processLookupResponseFn': (id, response) => {
              const parsed = JSON.parse(response.responseText);
              //console.log(stringifyObject(parsed));
              if (parsed.parameter){
                for (let i = 0; i < parsed.parameter.length; i++){
                  if (parsed.parameter[i].name === 'display'){
                    return parsed.parameter[i].valueString;
                  }
                }
              }
            throw 'Failed to find result in response';
            },
  'lookupAjaxOptionsFn':  (id) => {},
  'searchUrlFn': (search)=> 'https://r4.ontoserver.csiro.au/fhir/ValueSet/$expand?_format=json&url='
          + encodeURI('http://snomed.info/sct?fhir_vs=refset/32570581000036105')
          + '&count=20&filter=' + encodeURI(search),
  'processSearchResponseFn': (search, response) => {
              const result = [];
              if (response && response.responseText) {
                const parsed = JSON.parse(response.responseText);
          
                if (parsed.expansion && parsed.expansion.contains) {
          
          
                  for (const v of parsed.expansion.contains) {
                    result.push({'text': v.display, 'value': v.code});
                  }
                }
              }
              return result;
            },
  'searchAjaxOptionsFn':  (id) => {}
}
```


### Default Terminology
If no options are provided to setup the terminologies the following defaults are used:

#### Disorder
```javascript
{
'type' : 'CTSS',
'ctssBaseUrl' : new XWiki.Document('OmimService', 'PhenoTips').getURL('get', 'outputSyntax=plain'),
'valueColumn' : 'id',
'textColumn' : 'name'
}
```
#### Phenotype
```javascript
{
'type' : 'CTSS',
'validIdRegex' : /^HP\:(\d)+$/i,
'ctssBaseUrl' : new XWiki.Document('SolrService', 'PhenoTips').getURL('get'),
'valueColumn' : 'id',
'textColumn' : 'name'
}
```
#### Gene
```javascript
{
'type' : 'Empty'
}
```


## Development Notes
Most of the classes involved in the terminology code can be found in src/script/terminology.
If you want to create a new terminology then the options are to create a subclass of AbstractTerminology, or 
AbstractAjaxTerminology. The code for constructing a terminology object from options at start up can be found
in src/script/pedigree.js inside a method _initialiseTerminology(termType, options)