import AbstractTerminology from 'pedigree/terminology/abstractTerminology';
import Sifter from 'sifter';

/**
 * StaticTerminology is a Terminology with a defined set of terms and does not go to a webservice to run a query.
 * It uses Sifter library for the searching.
 * @type {klass}
 */
const StaticTerminology = Class.create( AbstractTerminology, {
  /**
   * Intitalize an AbstractTerminology object.
   * @param {Klass} type
   * @param {String} type
   * @param {RegExp} validIdRegex
   * @param {number} searchCount
   * @param terms
   */
  initialize: function ($super, type, validIdRegex, searchCount, terms) {
    $super(type, validIdRegex, searchCount);
    this._terms = terms;
    this._sifter = new Sifter(terms);
    this._lookup = {}
    for (let t of terms){
      this._lookup[t.value] = t.text;
    }
  },
  /**
   * Lookup a terminology term.
   * @param {String} id - The Id to lookup
   * @param onSuccess - Function of the form fn(id, name) to be called when the term lookup is successful.
   * @param onError - Function of the form fn(err) to be called when the term lookup fails.
   * @param onComplete - Function of the form fn() to be called when the term lookup completes.
   */
  lookupTerm: function (id, onSuccess, onError, onComplete) {
    if (this._lookup.hasOwnProperty(id)){
      onSuccess(id, this._lookup[id]);
    }
    else {
      onError('Term ' + id + ' not found');
    }
    onComplete();
  },
  /**
   * Search the terminology for available terms.
   * @param {String} searchTerm - The search string
   * @param onSuccess - Function of the form fn(searchTerm, result) to be called when the search is successful. the
   *            result which is the second argument is an array of objects with a 'value' for the id and 'text' for the name.
   * @param onError - Function of the form fn(err) to be called when the search fails.
   * @param onComplete - Function of the form fn() to be called when the search completes.
   */
  searchForTerms: function (searchTerm, onSuccess, onError, onComplete) {
    const foundTerms = this._sifter.search(searchTerm, {
      fields: ['text'],
      sort: [{field: 'text', direction: 'asc'}],
      limit: this._searchCount
    });
    let result = [];
    for (let ft of foundTerms.items){
      result.push(this._terms[ft.id]);
    }
    onSuccess(searchTerm, result);
    if (onComplete){
      onComplete();
    }
  }
});

export default StaticTerminology;