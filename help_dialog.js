const Clutter        = imports.gi.Clutter;
const Lang = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const MessageTray = imports.ui.messageTray;
const St = imports.gi.St;

const HelpDialog = new Lang.Class({
  Name: 'HelpDialog',
  Extends: ModalDialog.ModalDialog,

  _init: function() {
    this.parent();

    let element = this._addContent('Shortcuts', 'header');
    this._addContent("CTRL-N - new task\nCTRL-F search\nCommand to open the extension: ");
    this._addContent("dbus-send --session --type=method_call --print-reply --dest=eu.kazjote.todo_lists.opener '/eu/kazjote/todo_lists/opener' 'eu.kazjote.todo_lists.opener.open'", 'help-entry', 'Entry');

    this._addContent('Adding new task', 'header');
    this._addContent('Simply enter task name and press enter. You might be asked using notification to authenticate.\nYou can use Smart Add syntax: http://www.rememberthemilk.com/help/?ctx=basics.smartadd.whatis')

    this._addContent('Searching', 'header');
    this._addContent('Type your search query and press enter. You might be asked to authenticate.\nYou can use advanced search options: http://www.rememberthemilk.com/help/?ctx=basics.search.advanced');

    this.setButtons([{ action: Lang.bind(this, this.close),
                       label: _("Close"),
                       key: Clutter.Escape }]);

    element.grab_key_focus();
  },

  _addContent: function(text, styleClass = '', elementType = 'Label') {
    let element;

    if(elementType == 'Entry') {
      element = new St.Entry({ text: text, style_class: styleClass });

      element.connect('key-release-event', function() {
        element.text = text;
      });
    } else {
      element = new MessageTray.URLHighlighter(text);
      element = element.actor;
      element.style_class = styleClass;
    }

    this.contentLayout.add_actor(element);

    return element;
  },
});
