const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const ModalDialog = imports.ui.modalDialog;
const Clutter = imports.gi.Clutter;

let entry, dialog, button, shown;

function _hideHello() {
    Main.uiGroup.remove_actor(entry);
    dialog.close();
    dialog = null;
    entry  = null;
}

function _showHello() {
  if (!entry) {
      entry = new St.Entry({ name:        "newTask",
                             hint_text:   "New task...",
                             track_hover: true,
                             style_class: 'task-entry' });

      global.log("Adding entry");
  }

  if (!dialog) {
    dialog = new ModalDialog.ModalDialog();
    dialog.contentLayout.add_actor(entry);
    dialog.open();
  }

  entry.opacity = 255;

  entry.grab_key_focus();

  entry.connect('key-press-event', function(object, event) {
    let symbol = event.get_key_symbol();

    global.log(symbol);

    if(symbol == Clutter.Escape) {
      _hideHello();
    }

    if(symbol == Clutter.Return) {
      _hideHello();
    }
  });
}

function init() {
    button = new St.Bin({ style_class: 'panel-button',
                          reactive: true,
                          can_focus: true,
                          x_fill: true,
                          y_fill: false,
                          track_hover: true });
    let icon = new St.Icon({ icon_name: 'system-run-symbolic',
                             style_class: 'system-status-icon' });

    button.set_child(icon);
    button.connect('button-press-event', _showHello);
}

function enable() {
    Main.panel._rightBox.insert_child_at_index(button, 0);
}

function disable() {
    Main.panel._rightBox.remove_child(button);
}
