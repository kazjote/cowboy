const St             = imports.gi.St;
const Clutter        = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const GLib           = imports.gi.GLib;
const Lang           = imports.lang;
const PanelMenu      = imports.ui.panelMenu;

const Main        = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu   = imports.ui.popupMenu;
const BoxPointer  = imports.ui.boxpointer;

const Me            = ExtensionUtils.getCurrentExtension();
const Rtm           = Me.imports.rtm;
const Authenticator = Me.imports.authenticator;
const Notifier      = Me.imports.notifier;
const TaskList      = Me.imports.task_list;
const HelpDialog    = Me.imports.help_dialog;
const DBusService   = Me.imports.dbus_service.DBusService;

const AppKey    = '7dfc8cb9f7985d712e355ee4526d5c88';
const AppSecret = '5792b9b6adbc3847';

let rtm, dbusService, authenticator, notifier, tray, taskList;

function _addEntry(content) {
    rtm.get('rtm.timelines.create', {}, function(resp) {
        let options = { timeline: resp.rsp.timeline, name: content, parse: 1 };
        rtm.get('rtm.tasks.add', options, function(resp) {
            if (resp.rsp.stat == 'ok') {
                notifier.notify("Task successfully created", content);
                taskList.refresh();
            } else {
                notifier.notify("Failed to create the task", content);
            }
        });
    });
}

function enable() {
    var theme = imports.gi.Gtk.IconTheme.get_default();
    let icon_dir = Me.dir.get_child('icons');
    theme.append_search_path(icon_dir.get_path());

    let icon = new St.Icon({ icon_name: 'rtm-symbolic',
                             style_class: 'system-status-icon' });

    tray = new PanelMenu.Button(0.5);

    dbusService = new DBusService(tray);
    dbusService.connect();

    notifier = new Notifier.Notifier();

    let panel = Main.panel._rightBox;
    let StatusArea = Main.panel._statusArea;

    if (StatusArea == undefined){
        StatusArea = Main.panel.statusArea;
    }

    Main.panel._addToPanelBox('cowboy', tray, 1, panel);

    let box = new St.BoxLayout();
    tray.actor.add_actor(box);
    box.add_actor(icon);

    let table_layout = new St.Table();

    let label = new St.Label({ name: 'newTaskLabel',
                               style_class: 'task-label',
                               text: "New task" });

    let entry = new St.Entry({ name: 'newTask',
                               hint_text: "New task...",
                               track_hover: true,
                               style_class: 'task-entry' });

    table_layout.add(label, {row: 0, col: 0, x_expand: false});
    table_layout.add(entry, {row: 0, col: 1, x_expand: true, x_fill: true, y_fill: false, y_expand: false});

    entry.connect('key-release-event', function(object, event) {
        let symbol = event.get_key_symbol();

        if(symbol == Clutter.Return) {
            let text = entry.get_text();

            authenticator.authenticated(function() {
                _addEntry(text);
            });

            entry.set_text('');
        }
    });

    tray.menu.connect('open-state-changed', function(self, open) {
        if(open) {
            entry.grab_key_focus();
        }
    });

    label = new St.Label({
          name: 'searchTaskLabel',
          style_class: 'task-label',
          text: "Search" });

    let searchEntry = new St.Entry({
          name: 'search',
          hint_text: "Search query...",
          track_hover: true,
          style_class: 'task-entry' });

    let processingLabel = new St.Label({
          name: 'processingLabel',
          style_class: 'processing-label' });

    rtm = new Rtm.RememberTheMilk(AppKey, AppSecret, 'write', processingLabel);
    authenticator = new Authenticator.RtmAuthenticator(rtm, notifier);

    table_layout.add(label, {row: 1, col: 0, x_expand: false});
    table_layout.add(searchEntry, {row: 1, col: 1, x_expand: true, x_fill: true, y_fill: false, y_expand: false});

    let processingLabelShown = false;

    processingLabel.hide = function() {
        if(processingLabelShown) {
            table_layout.remove_actor(processingLabel);
            processingLabelShown = false;
        }
    };

    processingLabel.show = function() {
        if(!processingLabelShown) {
            table_layout.add(processingLabel, { row: 2 });
            processingLabelShown = true;
        }
    };

    let helpIcon = St.Icon.new();
    let iconButton = St.Button.new();
    iconButton.child = helpIcon;

    table_layout.add(iconButton, { row: 0, col: 2, x_expand: false });

    helpIcon.icon_name = 'dialog-question-symbolic';
    helpIcon.icon_size = 16;
    helpIcon.style_class = 'help-icon';

    iconButton.connect('clicked', function() {
        let dialog = new HelpDialog.HelpDialog();
        dialog.open();
        tray.menu.close();
    });

    let main_box = new St.BoxLayout({vertical: true});

    main_box.add(table_layout);

    let menu_item = new PopupMenu.PopupBaseMenuItem({reactive: false});

    menu_item.addActor(main_box, {expand: true});

    taskList = new TaskList.TaskList(tray.menu, authenticator, rtm, notifier);

    tray.menu.actor.connect('key-release-event', function(object, event) {
        let modifiers = event.get_state();

        if (modifiers & Clutter.ModifierType.CONTROL_MASK) {
            if(event.get_key_symbol() == Clutter.n) {
                entry.grab_key_focus();
            }

            if(event.get_key_symbol() == Clutter.f) {
                searchEntry.grab_key_focus();
            }
        }
    });

    searchEntry.connect('key-release-event', function(object, event) {
        if(event.get_key_symbol() == Clutter.Return) {
            taskList.refresh(searchEntry.text);
            searchEntry.text = '';
        }
    });

    tray.menu.addMenuItem(menu_item);
}

function disable() {
    dbusService.disconnect();
    authenticator.close();
    tray.actor.destroy();
}

// vim: ts=4 sw=4
