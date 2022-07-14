import FhirTerminologyHelper from 'pedigree/FhirTerminologyHelper';

/**
 * Default implementation of FhirTerminologyHelper. Based on the service urls in
 * disorder and hpoTerm, this will use omim and hpo.
 *
 * @type {klass}
 */
var DefaultFhirTerminologyHelper = Class.create( FhirTerminologyHelper, {
  initialize: function(disorderCS='http://www.omim.org',
    phenotypeCS='http://purl.obolibrary.org/obo/hp.fhir',
    geneCS=null) {
    this._disorderCS = disorderCS;
    this._phenotypeCS = phenotypeCS;
    this._geneCS = geneCS;
  },

  _getCodeableConceptFromLegend: function(code, legend, codeSystem) {
    let cachedTerm = legend.getTerm(code);
    if (cachedTerm.isUnknown()){
      // code and name are the same
      console.log("Unknown term, just use text", cachedTerm);
      return { 'text': code };
    } else {
      // term from terminology
      return  {
        'coding': [
          {
            'system': codeSystem,
            'code': code,
            'display': cachedTerm.getName()
          }
        ]
      };
    }
  },

  getCodeableConceptFromDisorder: function(disorder) {
    return this._getCodeableConceptFromLegend(disorder, editor.getDisorderLegend(), this._disorderCS);
  },

  getCodeableConceptFromPhenotype: function(phenotype) {
    return this._getCodeableConceptFromLegend(phenotype, editor.getPhenotypeLegend(), this._phenotypeCS);
  },

  getCodeableConceptFromGene: function(gene) {
    return this._getCodeableConceptFromLegend(gene, editor.getGeneLegend(), this._geneCS);
  },


  _getCodeFromCodeableConcept: function(codeSystem, codeableConcept, returnNullOnNoMatch ) {
    let foundCode = false;
    let code = undefined;

    if (codeableConcept.coding){
      for (const coding of codeableConcept.coding){
        if (!code && coding.display){
          // use the first display found as a fall back.
          code = coding.display;
        }
        if (coding.system && coding.system === codeSystem){
          code = coding.code;
          foundCode = true;
          break;
        }
      }
    }
    if (!foundCode && codeableConcept.text){
      code = codeableConcept.text;
    }
    if (!foundCode && returnNullOnNoMatch){
      return null;
    }
    return code;

  },

  getDisorderFromCodeableConcept: function(codeableConcept, returnNullOnNoMatch ) {
    return this._getCodeFromCodeableConcept(this._disorderCS, codeableConcept, returnNullOnNoMatch);
  },

  getPhenotypeFromCodeableConcept: function(codeableConcept, returnNullOnNoMatch) {
    return this._getCodeFromCodeableConcept(this._phenotypeCS, codeableConcept, returnNullOnNoMatch);
  },

  getGeneFromCodeableConcept: function(codeableConcept, returnNullOnNoMatch) {
    return this._getCodeFromCodeableConcept(this._geneCS, codeableConcept, returnNullOnNoMatch);
  }

});

export default DefaultFhirTerminologyHelper;
