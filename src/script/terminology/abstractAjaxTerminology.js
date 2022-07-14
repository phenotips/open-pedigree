import AbstractTerminology from 'pedigree/terminology/abstractTerminology';

const AbstractAjaxTerminology = Class.create( AbstractTerminology, {
  /**
   * Intitalize an AbstractTerminology object.
   * @param {Klass} type
   * @param {String} type
   * @param {RegExp} validIdRegex
   * @param {number} searchCount
   */
  initialize: function($super, type, validIdRegex, searchCount) {
    $super(type, validIdRegex, searchCount);
  },
  /**
   * Get the url to lookup a specific term with this terminology.
   * This is the abstract version of the method that needs to be overwritten by subclasses. This version will throw
   * an exception.
   * @param {String} id
   * @returns {String} The lookup url to fetch the desired term.
   */
  getLookupURL: function(id){
    throw 'Unimplemented method - should be using subclass';
  },
  /**
   * Return the Ajax options required when calling the lookup URL with ajax to fetch the term.
   * This is the abstract version of the method that needs to be overwritten by subclasses. This version will throw
   * an exception.
   * @param {String} id
   * @returns {{}} Ajax options to use when fetching the specified term.
   */
  getLookupAjaxOptions: function(id){
    return {};
  },
  /**
   * Process the
   * @param response
   */
  processLookupResponse: function(id, response){
    throw 'Unimplemented method - should be using subclass';
  },
  getSearchURL: function(searchTerm){
    throw 'Unimplemented method - should be using subclass';
  },
  /** Subclasses should override this if a lookup requires special options, such as a POST */
  getSearchAjaxOptions: function(searchTerm){
    return {};
  },
  processSearchResponse: function(searchTerm, response){
    throw 'Unimplemented method - should be using subclass';
  },
  /**
   * Lookup a terminology term.
   * @param {String} id - The Id to lookup
   * @param onSuccess - Function of the form fn(id, name) to be called when the term lookup is successful.
   * @param onError - Function of the form fn(err) to be called when the term lookup fails.
   * @param onComplete - Function of the form fn() to be called when the term lookup completes.
   */
  lookupTerm : function($super, id, onSuccess, onError, onComplete){
    const queryURL = this.getLookupURL(id);
    const extraAjaxOptions = this.getLookupAjaxOptions(id);
    const ajaxOptions = {
      method: 'GET',
      requestHeaders: {
        'X-Requested-With': null,
        'X-Prototype-Version': null
      },
      onSuccess: (response) => {
        try {
          const result = this.processLookupResponse(id, response);
          console.debug('LOADED ' + this._type + ' term: id = ' + this.desanitizeID(id) + ', name = ' + result);
          onSuccess(id, result);
        } catch (err) {
          console.error('[LOAD ' + this._type + ' term: id = ' + this.desanitizeID(id) +'] Error: ' +  err);
          onError(err);
        }
      },
      onError: (error) => {
        console.error('[LOAD ' + this._type + ' term: id = ' + this.desanitizeID(id) +'] Error: ' +  error);
        onError(error);
      },
      onComplete: onComplete ? onComplete : {},
      ...extraAjaxOptions
    };
    new Ajax.Request(queryURL, ajaxOptions);
  },
  /**
   * Search the terminology for available terms.
   */
  searchForTerms : function($super, searchTerm, onSuccess, onError, onComplete){
    const queryURL = this.getSearchURL(searchTerm);
    const extraAjaxOptions = this.getSearchAjaxOptions(searchTerm);
    const ajaxOptions = {
      method: 'GET',
      contentType: 'application/json; charset=utf-8',
      requestHeaders: {
        'X-Requested-With': null,
        'X-Prototype-Version': null
      },
      onSuccess: (response) => {
        try {
          const result = this.processSearchResponse(searchTerm, response);
          onSuccess(searchTerm, result);
        } catch (err) {
          console.log('Error searching for ' + this.getType() + ' with searchTerm "' + searchTerm + '": ' +  err);
          onError(err);
        }
      },
      onError: (error) => {
        console.log('Error searching for ' + this.getType() + ' with searchTerm "' + searchTerm + '": ' +  error);
        onError(error);
      },
      onComplete: onComplete ? onComplete : {},
      ...extraAjaxOptions
    };
    new Ajax.Request(queryURL, ajaxOptions);
  }
});

export default AbstractAjaxTerminology;
