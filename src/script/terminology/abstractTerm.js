import AbstractTerminology from 'pedigree/terminology/abstractTerminology';

const AbstractTerm = Class.create( {

  /**
   *
   * @param {String} type - term type
   * @param {String} id - Id of the term
   * @param {String} name
   * @param {AbstractTerminology} terminology
   * @param {function} callWhenReady
   */
  initialize: function(type, id, name, terminology, callWhenReady) {
    // user-defined terms
    this._type = type;
    this._originalId = id;
    this._isUnknown = false;
    if (terminology){
      const sanitizedId = terminology.sanitizeID(id);
      const desanitizedId = terminology.desanitizeID(id);
      if (name == null && !terminology.isValidID(desanitizedId)) {
        name = desanitizedId;
        this._isUnknown = true;
      }

      this._id  = sanitizedId;
      this._name   = name ? name : 'loading...';

      if (!name && callWhenReady) {
        this._isUnknown = true;
        this.load(terminology, callWhenReady);
      }
    }
    else {
      // no terminology to lookup use defaults
      console.log('Creating term with no terminology');
      const tempTerminology = new AbstractTerminology(type, /.*/, 20);
      this._id = tempTerminology.sanitizeID(id);
      this._name = tempTerminology.desanitizeID(id);
      this._isUnknown = true;
      if (callWhenReady){
        callWhenReady();
      }
    }

  },

  /**
   * Returns the type of the term.
   * @returns {String}
   */
  getTermType : function(){
    return this._type;
  },

  /**
   * Returns the ID of the term
   * @returns {String} Returns the ID of the term
   */
  getID: function() {
    return this._id;
  },

  /**
   * Returns the name of the term
   * @returns {String} Returns the name of the term
   */
  getName: function() {
    return this._name;
  },

  isUnknown: function() {
    return this._isUnknown;
  },
  /**
   * Uses the terminology object to load the data associated with this term, calling the callWhenReady function once
   * complete.
   * @param {AbstractTerminology} terminology
   * @param {function} callWhenReady
   */
  load: function(terminology, callWhenReady) {
    terminology.lookupTerm(this._id,
      (id, name) => this._name = name,
      (err) => {this._name = terminology.desanitizeID(this._originalId); this._isUnknown = true;},
      callWhenReady
    );
  }
});


export default AbstractTerm;
