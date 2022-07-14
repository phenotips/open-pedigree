
import AbstractTerm from 'pedigree/terminology/abstractTerm';

export var PhenotypeTermType = 'phenotype';

var PhenotypeTerm = Class.create(AbstractTerm, {

  initialize: function($super, id, name, terminology, callWhenReady) {
    $super(PhenotypeTermType, id, name, terminology, callWhenReady);
  },
});

export default PhenotypeTerm;
