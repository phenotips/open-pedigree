import PedigreeEditor from './script/pedigree';

import '../public/vendor/font-awesome/css/font-awesome.css'
import '../public/vendor/xwiki/xwiki-min.css';
import '../public/vendor/xwiki/fullScreen.css';
import '../public/vendor/xwiki/colibri.css';
import '../public/vendor/phenotips/Widgets.css';
import '../public/vendor/phenotips/DateTimePicker.css';
import '../public/vendor/phenotips/Skin.css';
import '../public/vendor/FontAwesomeIcons.css';
import '../public/vendor/selectize/selectize.default.css';

var editor;

document.observe('dom:loaded',function() {
  editor = new PedigreeEditor();
});
