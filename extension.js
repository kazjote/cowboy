const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const ModalDialog = imports.ui.modalDialog;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const GLib = imports.gi.GLib;
const Lang = imports.lang;

const Me = ExtensionUtils.getCurrentExtension();

window.md5 = function(str) {
  return GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, str, str.length);
}

const Rtm = Me.imports.rtm;

const AppKey = '7dfc8cb9f7985d712e355ee4526d5c88';
const AppSecret = '5792b9b6adbc3847';

let entry, dialog, button, shown, rtm, dbusNameId, dbusOpener;

const DBusOpenerInterface = <interface name='eu.kazjote.todo_lists.opener'>
  <method name="open">
  </method>
</interface>;

const DBusOpener = new Lang.Class({
  Name: 'DBusOpener',

  _init: function() {
    this._impl = Gio.DBusExportedObject.wrapJSObject(DBusOpenerInterface, this);
    this._impl.export(Gio.DBus.session, '/eu/kazjote/todo_lists/opener');
  },

  /*
   * Invoke with:
   * dbus-send --session --type=method_call --print-reply --dest=eu.kazjote.todo_lists.opener '/eu/kazjote/todo_lists/opener' 'eu.kazjote.todo_lists.opener.open'
   */
  open: function(args) {
    _showHello();
    return 0;
  }
});


function _hideHello() {
  Main.uiGroup.remove_actor(entry);
  dialog.close();
  dialog = null;
  entry  = null;
}

function _setToken(frob) {
  rtm.get('rtm.auth.getToken', { frob: frob }, function(resp) {
    if (resp.rsp.stat == 'ok') {
      rtm.auth_token = resp.rsp.auth.token;
    } else {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, function() {
        _setToken(frob);
      });
    }
  });
}

function _addEntry(content) {
  rtm.get('rtm.timelines.create', {}, function(resp) {
    if (resp.rsp.stat == 'ok') {
      rtm.get('rtm.tasks.add', { timeline: resp.rsp.timeline, name: content, parse: 1 });
    } else {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, function() {
        _addEntry(content);
      });
    }
  });
}

function _showHello() {
  if (!entry) {
    entry = new St.Entry({ name:        "newTask",
                           hint_text:   "New task...",
                           track_hover: true,
                           style_class: 'task-entry' });
  }

  if (!dialog) {
    dialog = new ModalDialog.ModalDialog();
    dialog.contentLayout.add_actor(entry);
    dialog.open();
  }

  entry.opacity = 255;

  entry.grab_key_focus();

  entry.connect('key-release-event', function(object, event) {
    let symbol = event.get_key_symbol();

    if(symbol == Clutter.Escape) {
      _hideHello();
    }

    if(symbol == Clutter.Return) {
      let text = entry.get_text();

      _hideHello();

      if (!rtm.auth_token) {
        log('Will get token');
        rtm.get('rtm.auth.getFrob', {}, function(resp) {
          let frob = resp.rsp.frob;
          let authUrl = rtm.getAuthUrl(frob);

          GLib.spawn_command_line_async("gnome-open '" + authUrl + "'");

          _setToken(frob);

          _addEntry(text);
        });
      } else {
        _addEntry(text);
      }
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

  rtm = new Rtm.RememberTheMilk(AppKey, AppSecret, 'write');
  dbusOpener = new DBusOpener();
}

function connectDBus() {
  dbusNameId = Gio.DBus.session.own_name('eu.kazjote.todo_lists.opener',
    Gio.BusNameOwnerFlags.NONE,
    function(name) { log("DBUS: obtained name"); },
    function(name) { connectDBus(); });
}

function enable() {
  Main.panel._rightBox.insert_child_at_index(button, 0);

  connectDBus();
}

function disable() {
  Main.panel._rightBox.remove_child(button);

  Gio.DBus.session.unown_name(dbusNameId);
}
