import Disorder from 'pedigree/disorder';
import HPOTerm from 'pedigree/hpoTerm';
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

  getCodeableConceptFromDisorder: function(disorder) {
    let cachedDisorder = editor.getDisorderLegend().getDisorder(disorder);
    if (cachedDisorder.getName() ===  Disorder.desanitizeID(disorder)){
      // code and name are the same
      return { 'text': disorder };
    } else {
      // disorder from omim
      return  {
        'coding': [
          {
            'system': this._disorderCS,
            'code': disorder,
            'display': cachedDisorder.getName()
          }
        ]
      };
    }
  },

  getCodeableConceptFromPhenotype: function(phenotype) {
    let cachedTerm = editor.getHPOLegend().getTerm(phenotype);
    if (cachedTerm.getName() ===  HPOTerm.desanitizeID(phenotype)){
      // code and name are the same
      return { 'text': phenotype };
    } else {
      // disorder from omim
      return  {
        'coding': [
          {
            'system': this._phenotypeCS,
            'code': phenotype,
            'display': cachedTerm.getName()
          }
        ]
      };
    }
  },

  getCodeableConceptFromGene: function(gene) {
    // the genes are not cached like the disorders and phenotypes.
    // Assume the value is in the code system if we have one.
    if (this._geneCS){
      return  {
        'coding': [
          {
            'system': this._geneCS,
            'code': gene,
          }
        ]
      };
    }
    return { 'text': gene };

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
