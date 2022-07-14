
import AbstractTerm from 'pedigree/terminology/abstractTerm';

export var DisorderTermType = 'disorder';

const DisorderTerm = Class.create(AbstractTerm, {

  initialize: function($super, id, name, terminology, callWhenReady) {
    $super(DisorderTermType, id, name, terminology, callWhenReady);
  },
});

export default DisorderTerm;
