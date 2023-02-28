import AbstractAjaxTerminology from 'pedigree/terminology/abstractAjaxTerminology';

const DelegatingTerminology = Class.create( AbstractAjaxTerminology, {

  initialize: function($super, type, validIdRegex, searchCount, lookupUrlFn, processLookupResponseFn,
    lookupAjaxOptionsFn, searchUrlFn, processSearchResponseFn, searchAjaxOptionsFn) {

    $super(type, validIdRegex, searchCount);
    this._lookupUrlFn = lookupUrlFn;
    this._processLookupResponseFn = processLookupResponseFn;
    this._lookupAjaxOptionsFn = lookupAjaxOptionsFn;
    this._searchUrlFn = searchUrlFn;
    this._processSearchResponseFn = processSearchResponseFn;
    this._searchAjaxOptionsFn = searchAjaxOptionsFn;
  },

  getLookupURL: function(id){
    return this._lookupUrlFn(id);
  },

  processLookupResponse: function(id, response){
    return this._processLookupResponseFn(id, response);
  },

  getSearchURL: function(searchTerm){
    return this._searchUrlFn(searchTerm);
  },

  processSearchResponse: function(searchTerm, response){
    return this._processSearchResponseFn(searchTerm, response);
  },

  getLookupAjaxOptions: function(id){
    if (this._lookupAjaxOptionsFn){
      return this._lookupAjaxOptionsFn(id);
    }
    return {};
  },

  getSearchAjaxOptions: function(searchTerm){
    if (this._searchAjaxOptionsFn){
      return this._searchAjaxOptionsFn(searchTerm);
    }
    return {};
  },

});

export default DelegatingTerminology;
