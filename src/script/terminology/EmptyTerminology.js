import AbstractTerminology from 'pedigree/terminology/abstractTerminology';


/**
 * EmptyTerminology is a Terminology with no defined terms.
 * @type {klass}
 */
const EmptyTerminology = Class.create( AbstractTerminology, {
  /**
   * Intitalize an AbstractTerminology object.
   * @param {Klass} type
   * @param {String} type
   * @param {RegExp} validIdRegex
   * @param {number} searchCount
   */
  initialize: function ($super, type, validIdRegex, searchCount) {
    $super(type, validIdRegex, searchCount);
  },
  /**
   * Lookup a terminology term.
   * @param {String} id - The Id to lookup
   * @param onSuccess - Function of the form fn(id, name) to be called when the term lookup is successful.
   * @param onError - Function of the form fn(err) to be called when the term lookup fails.
   * @param onComplete - Function of the form fn() to be called when the term lookup completes.
   */
  lookupTerm: function (id, onSuccess, onError, onComplete) {
    onError('Empty Terminology has no terms');
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
    onSuccess(searchTerm, []);
    onComplete();
  }
});

export default EmptyTerminology;