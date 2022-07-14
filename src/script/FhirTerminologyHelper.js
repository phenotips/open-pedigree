import Disorder from 'pedigree/disorder';
import HPOTerm from 'pedigree/hpoTerm';


/**
 * Base for FhirTerminologyHelper which knows how to convert to and from CodeableConcept.
 * This will be based on what code systems are used for disorders, phenotypes and genes.
 * @type {klass}
 */
var FhirTerminologyHelper = Class.create( {
  initialize: function() {
  },

  getCodeableConceptFromDisorder: function(disorder) {
    return null;
  },

  getCodeableConceptFromPhenotype: function(phenotype) {
    return null;
  },

  getCodeableConceptFromGene: function(gene) {
    return null;
  },

  getDisorderFromCodeableConcept: function(codeableConcept, returnNullOnNoMatch ) {
    return null;
  },

  getPhenotypeFromCodeableConcept: function(codeableConcept, returnNullOnNoMatch) {
    return null;
  },

  getGeneFromCodeableConcept: function(codeableConcept, returnNullOnNoMatch) {
    return null;
  }

});




export default FhirTerminologyHelper;
