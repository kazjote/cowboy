const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;

const BoxPointer = imports.ui.boxpointer;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const ModalDialog = imports.ui.modalDialog;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Me = ExtensionUtils.getCurrentExtension();
const ActionBox = Me.imports.action_box.ActionBox;
const Authenticator = Me.imports.authenticator;
const DBusService = Me.imports.dbus_service.DBusService;
const Notifier = Me.imports.notifier;
const Rtm = Me.imports.rtm;
const TaskList = Me.imports.task_list;

const AppKey = '7dfc8cb9f7985d712e355ee4526d5c88';
const AppSecret = '5792b9b6adbc3847';

let rtm, dbusService, authenticator, notifier, tray, taskList;

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

    let processingLabel = new St.Label({
          name: 'processingLabel',
          style_class: 'processing-label' });

    rtm = new Rtm.RememberTheMilk(AppKey, AppSecret, 'write', processingLabel);
    authenticator = new Authenticator.RtmAuthenticator(rtm, notifier);

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

    taskList = new TaskList.TaskList(tray.menu, authenticator, rtm, notifier);

    let actionBox = new ActionBox(table_layout, tray.menu, authenticator, rtm, taskList, notifier);
    actionBox.setup();

    let main_box = new St.BoxLayout({vertical: true});

    main_box.add(table_layout);

    let menu_item = new PopupMenu.PopupBaseMenuItem({reactive: false});

    if(menu_item.addActor === undefined) {
        menu_item.actor.add(main_box, {expand: true});
    } else {
        menu_item.addActor(main_box, {expand: true});
    }

    tray.menu.addMenuItem(menu_item);
}

function disable() {
    dbusService.disconnect();
    authenticator.close();
    tray.actor.destroy();
}

// vim: ts=4 sw=4
