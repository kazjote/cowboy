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
const Md5 = Me.imports.md5;

window.md5 = function(str) {
  // I tried glib md5 but it didn't work out
  return Md5.hex_md5(str);
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
      let token = resp.rsp.auth.token;
      rtm.auth_token = token;
      _save_token(token);
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

function _save_token(token) {
  let path = GLib.get_home_dir() + '/.todo_lists_rtm_token';
  let file = Gio.File.new_for_path(path);

  let stream = file.replace(null, false, null, null, null);

  stream.write(token, null, null, null);
  stream.close(null);
}

function _load_token() {
  let path = GLib.get_home_dir() + '/.todo_lists_rtm_token';
  let file = Gio.File.new_for_path(path);
 
  try {
    let stream = file.read(null, null);
    let dstream = new Gio.DataInputStream({base_stream: stream});
    let token = dstream.read_until('', null)[0];

    stream.close(null);

    return token;
  } catch (e) {
    log('Exception while reading file');
    log(e)
    return null;
  }
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

      if (!rtm.auth_token && !(rtm.auth_token = _load_token())) {
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
