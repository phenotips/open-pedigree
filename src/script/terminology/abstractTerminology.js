import DisorderTerm, {DisorderTermType} from 'pedigree/terminology/disorderTerm';
import GeneTerm, {GeneTermType} from 'pedigree/terminology/geneTerm';
import PhenotypeTerm, {PhenotypeTermType} from 'pedigree/terminology/phenotypeTerm';
import AbstractTerm from 'pedigree/terminology/abstractTerm';

const AbstractTerminology = Class.create( {
  /**
   * Intitalize an AbstractTerminology object.
   * @param {String} type
   * @param {RegExp} validIdRegex
   * @param {number} searchCount
   */
  initialize: function(type, validIdRegex, searchCount) {
    this._type = type;
    this._validIdRegex = validIdRegex;
    this._searchCount = searchCount || 20;
  },
  /**
   * Get the term type this terminology looks up.
   * @returns {String}
   */
  getType: function(){
    return this._type;
  },

  /**
   * Test is an id is valid for this terminology.
   * @param {String} id
   * @returns {boolean} True if the passed id is a suitable format for this terminology.
   */
  isValidID: function(id){
    if (this._validIdRegex){
      return this._validIdRegex.test(id);
    }
    return true;
  },
  /**
   * Gets the number of search terms this terminology will return when searching.
   * @returns {number}
   */
  getSearchCount: function(){
    return this._searchCount;
  },

  /**
   * Turn a sanitized ID back to its original form.
   * @param {String} id - The Id to desanitize
   * @returns {String} The original version of the sanitized Id.
   */
  desanitizeID : function(id){
    let temp = id;
    temp = temp.replace(/_C_/g, ':');
    temp = temp.replace(/_L_/g, '(');
    temp = temp.replace(/_J_/g, ')');
    temp = temp.replace(/_D_/g, '.');
    temp = temp.replace(/_S_/g, '/');
    temp = temp.replace(/__/g, ' ');
    return temp;
  },
  /**
   * Sanatize a terminology Id to make suitable for display.
   * @param {String} id - The Id to sanitize
   * @returns {String} The sanitized version of the Id.
   */
  sanitizeID : function(id){
    let temp = id;
    temp = temp.replace(/[:]/g, '_C_');
    temp = temp.replace(/[([]/g, '_L_');
    temp = temp.replace(/[)]]/g, '_J_');
    temp = temp.replace(/[.]/g, '_D_');
    temp = temp.replace(/\//g, '_S_');
    temp = temp.replace(/[^a-zA-Z0-9,;_\-*]/g, '__');
    return temp;
  },

  /**
   * Lookup a terminology term.
   * @param {String} id - The Id to lookup
   * @param onSuccess - Function of the form fn(id, name) to be called when the term lookup is successful.
   * @param onError - Function of the form fn(err) to be called when the term lookup fails.
   * @param onComplete - Function of the form fn() to be called when the term lookup completes.
   */
  lookupTerm : function(id, onSuccess, onError, onComplete){
    throw 'Unimplemented method - should be using subclass';
  },
  /**
   * Search the terminology for available terms.
   * @param {String} searchTerm - The search string
   * @param onSuccess - Function of the form fn(searchTerm, result) to be called when the search is successful. the
   *            result which is the second argument is an array of objects with a 'value' for the id and 'text' for the name.
   * @param onError - Function of the form fn(err) to be called when the search fails.
   * @param onComplete - Function of the form fn() to be called when the search completes.
   */
  searchForTerms : function(searchTerm, onSuccess, onError, onComplete){
    throw 'Unimplemented method - should be using subclass';
  },
  createTerm : function(id, name, callWhenReady){
    if (this._type === DisorderTermType) {
      return new DisorderTerm(id, name, this, callWhenReady);
    }
    if (this._type === GeneTermType){
      return new GeneTerm(id, name, this, callWhenReady);
    }
    if (this._type === PhenotypeTermType){
      return new PhenotypeTerm(id, name, this, callWhenReady);
    }
    console.error('No explicit class for type \'' + this._type + '\'');
    return new AbstractTerm(this._type, id, name, callWhenReady);
  }
});

export default AbstractTerminology;
