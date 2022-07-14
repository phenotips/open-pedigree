import AbstractAjaxTerminology from 'pedigree/terminology/abstractAjaxTerminology';

const CTSSTerminology = Class.create( AbstractAjaxTerminology, {

  initialize: function($super, type, validIdRegex, searchCount, ctssBaseUrl, valueColumn, textColumn) {
    $super(type, validIdRegex, searchCount);
    this._ctssBaseUrl = ctssBaseUrl;
    this._valueColumn = valueColumn;
    this._textColumn = textColumn;
  },

  getLookupURL: function(id){
    return this._ctssBaseUrl + '?q=' + encodeURI(this._valueColumn) + '%3A' + encodeURI(this.desanitizeID(id).replace(':','\\:'));
  },

  processLookupResponse: function(id, response){
    const parsed = JSON.parse(response.responseText);
    //console.log(stringifyObject(parsed));
    if (parsed.length > 3 && parsed[3] && parsed[3][0]){
      return parsed[3][0][1];
    }
    throw 'Failed to find result in response';
  },

  getSearchURL: function(searchTerm){
    return this._ctssBaseUrl + '?df=' + encodeURI(this._valueColumn) + ',' + encodeURI(this._textColumn) +'&maxList=' + this.getSearchCount() + '&term=' + encodeURI(searchTerm);
  },
  processSearchResponse: function(searchTerm, response){
    if (response && response.responseText) {
      const parsed = JSON.parse(response.responseText);

      if (parsed.length > 3 && parsed[3]) {

        const result = [];
        for (const v of parsed[3]) {
          result.push({'text': v[1], 'value': v[0]});
        }
        return result;
      }
    }
  }

});

export default CTSSTerminology;
