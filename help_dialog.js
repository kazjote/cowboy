const Clutter        = imports.gi.Clutter;
const Lang = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const St = imports.gi.St;

const HelpDialog = new Lang.Class({
  Name: 'HelpDialog',
  Extends: ModalDialog.ModalDialog,

  _init: function() {
    this.parent();
    let label = new St.Label({ name: 'helpLabel',
                               text: 'help text' });

    this.contentLayout.add_actor(label);

    this.setButtons([{ action: Lang.bind(this, this.close),
                       label: _("Close"),
                       key: Clutter.Escape }]);

    label.grab_key_focus();
  }
});
