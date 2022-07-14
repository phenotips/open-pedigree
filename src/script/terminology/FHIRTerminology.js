import AbstractAjaxTerminology from 'pedigree/terminology/abstractAjaxTerminology';

const FHIRTerminology = Class.create( AbstractAjaxTerminology, {

  initialize: function($super, type, codeSystem, validIdRegex, searchCount, fhirBaseUrl, valueSet,
    lookupAjaxOptions = {}, searchAjaxOptions = {}) {
    $super(type, validIdRegex, searchCount);
    this._codeSystem   = codeSystem;
    this._fhirBaseUrl = fhirBaseUrl;
    this._valueSet     = valueSet;
    this._lookupAjaxOptions = lookupAjaxOptions;
    this._searchAjaxOptions = searchAjaxOptions;
  },

  getCodeSystem: function(){
    return this._codeSystem;
  },

  getLookupURL: function(id){
    return this._fhirBaseUrl + '/CodeSystem/$lookup?_format=json'
      + '&system=' + encodeURI(this.getCodeSystem())
      + '&code=' + encodeURI(this.desanitizeID(id));
  },

  processLookupResponse: function(id, response){
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

  getSearchURL: function(searchTerm){
    return this._fhirBaseUrl
      + '/ValueSet/$expand?_format=json&url=' + encodeURI(this._valueSet)
      + '&count=' + this.getSearchCount() + '&filter=' + encodeURI(searchTerm);
  },
  processSearchResponse: function(searchTerm, response){
    if (response && response.responseText) {
      const parsed = JSON.parse(response.responseText);

      if (parsed.expansion && parsed.expansion.contains) {

        const result = [];
        for (const v of parsed.expansion.contains) {
          result.push({'text': v.display, 'value': v.code});
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

export default FHIRTerminology;
