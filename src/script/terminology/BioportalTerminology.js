import AbstractAjaxTerminology from 'pedigree/terminology/abstractAjaxTerminology';

const BioportalTerminology = Class.create( AbstractAjaxTerminology, {

  initialize: function($super, type, validIdRegex, searchCount, bioportalBaseUrl, ontology,
    apiKey, lookupAjaxOptions = {}, searchAjaxOptions = {}) {
    $super(type, validIdRegex, searchCount);
    this._bioportalBaseUrl   = bioportalBaseUrl;
    this._ontology = ontology;
    this._apiKey = apiKey;
    this._lookupAjaxOptions = lookupAjaxOptions;
    this._searchAjaxOptions = searchAjaxOptions;
  },

  getLookupURL: function(id){
    return this._bioportalBaseUrl + '/search?q=' + encodeURI(this.desanitizeID(id))
      + '&ontologies=' + encodeURI(this._ontology)
      + (this._apiKey ? ('&apikey=' + this._apiKey) : '')
      + '&require_exact_match=true&include=prefLabel,notation&display_links=false&display_context=false&format=json';

  },

  processLookupResponse: function(id, response){
    const parsed = JSON.parse(response.responseText);
    const dsId = this.desanitizeID(id);
    if (parsed.collection){
      for (let i = 0; i < parsed.collection.length; i++){
        if (parsed.collection[i].notation === dsId){
          return parsed.collection[i].prefLabel;
        }
      }
    }
    throw 'Failed to find result in response';
  },

  getSearchURL: function(searchTerm){
    return this._bioportalBaseUrl + '/search?q=' + encodeURI(searchTerm)
      + '&ontologies=' + encodeURI(this._ontology)
      + (this._apiKey ? ('&apikey=' + this._apiKey) : '')
      + (this._searchCount ? ('&pagesize=' + this._searchCount) : '')
      + '&suggest=true&include=prefLabel,notation&display_links=false&display_context=false&format=json';
  },
  processSearchResponse: function(searchTerm, response){
    if (response && response.responseText) {
      const parsed = JSON.parse(response.responseText);

      if (parsed.collection) {

        const result = [];
        for (const v of parsed.collection) {
          result.push({'text': v.prefLabel, 'value': v.notation});
        }
        return result;
      }
    }
  },
  getLookupAjaxOptions: function(id){
    return this._lookupAjaxOptions;
  },
  getSearchAjaxOptions: function(search){
    return this._searchAjaxOptions;
  },

});

export default BioportalTerminology;
