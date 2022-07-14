
import AbstractTerm from 'pedigree/terminology/abstractTerm';

export var GeneTermType = 'gene';

var GeneTerm = Class.create(AbstractTerm, {

  initialize: function($super, id, name, terminology, callWhenReady) {
    $super(GeneTermType, id, name, terminology, callWhenReady);
  },
});

export default GeneTerm;
