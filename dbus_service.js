const Gio = imports.gi.Gio;
const Lang = imports.lang;

const DBusOpenerInterface = <interface name='eu.kazjote.todo_lists.opener'>
    <method name='open'>
    </method>
</interface>;

const DBusService = new Lang.Class({
    Name: 'DBusOpener',

    //// Public methods ////

    _init: function(tray) {
        this._tray = tray;
        this._impl = Gio.DBusExportedObject.wrapJSObject(DBusOpenerInterface, this);
        this._impl.export(Gio.DBus.session, '/eu/kazjote/todo_lists/opener');
    },

    /*
     * Invoke with:
     * dbus-send --session --type=method_call --print-reply --dest=eu.kazjote.todo_lists.opener '/eu/kazjote/todo_lists/opener' 'eu.kazjote.todo_lists.opener.open'
     */
    open: function(args) {
        this._tray.menu.open();
        return 0;
    },

    connect: function() {
        this._nameId = Gio.DBus.session.own_name('eu.kazjote.todo_lists.opener',
            Gio.BusNameOwnerFlags.NONE,
            function(name) { },
            Lang.bind(this, function(name) { this.connect(); }));
    },

    disconnect: function() {
        this._impl.unexport();
        Gio.DBus.session.unown_name(this._nameId);
    }
});

// vim: ts=4 sw=4
