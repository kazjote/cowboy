const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const Lang = imports.lang;
const St = imports.gi.St;

const Me = ExtensionUtils.getCurrentExtension();
const HelpDialog = Me.imports.help_dialog;

const ActionBox = new Lang.Class({
    Name: 'ActionBox',

    _init: function(layout, trayMenu, authenticator, rtm, taskList, notifier) {
        this._layout = layout;
        this._authenticator = authenticator;
        this._rtm = rtm;
        this._taskList = taskList;
        this._trayMenu = trayMenu;
        this._notifier = notifier;
    },

    setup: function() {
        let taskEntry = this._setupNewTask();
        let searchEntry = this._setupSearch();

        this._setupHelp();

        this._trayMenu.actor.connect('key-release-event', function(object, event) {
            let modifiers = event.get_state();

            if (modifiers & Clutter.ModifierType.CONTROL_MASK) {
                if(event.get_key_symbol() == Clutter.n) {
                    taskEntry.grab_key_focus();
                }

                if(event.get_key_symbol() == Clutter.f) {
                    searchEntry.grab_key_focus();
                }
            }
        });

        this._trayMenu.connect('open-state-changed', function(self, open) {
            if(open) {
                taskEntry.grab_key_focus();
            }
        });
    },

    _setupNewTask: function() {
        let label = new St.Label({ name: 'newTaskLabel',
                                   style_class: 'task-label',
                                   text: "New task" });

        let entry = new St.Entry({ name: 'newTask',
                                   hint_text: "New task...",
                                   track_hover: true,
                                   style_class: 'task-entry' });

        this._layout.add(label, {row: 0, col: 0, x_expand: false});
        this._layout.add(entry, {row: 0, col: 1, x_expand: true, x_fill: true, y_fill: false, y_expand: false});

        entry.connect('key-release-event', Lang.bind(this, function(object, event) {
            let symbol = event.get_key_symbol();

            if(symbol == Clutter.Return) {
                let text = entry.get_text();

                this._authenticator.authenticated(Lang.bind(this, function() {
                    this._addEntry(text);
                }));

                entry.set_text('');
            }
        }));

        return entry;
    },

    _setupSearch: function() {
        let label = new St.Label({
              name: 'searchTaskLabel',
              style_class: 'task-label',
              text: "Search" });

        let entry = new St.Entry({
              name: 'search',
              hint_text: "Search query...",
              track_hover: true,
              style_class: 'task-entry' });

        this._layout.add(label, {row: 1, col: 0, x_expand: false});
        this._layout.add(entry, {row: 1, col: 1, x_expand: true, x_fill: true, y_fill: false, y_expand: false});

        entry.connect('key-release-event', Lang.bind(this, function(object, event) {
            if(event.get_key_symbol() == Clutter.Return) {
                this._taskList.refresh(entry.text);
                entry.text = '';
            }
        }));

        return entry;
    },

    _setupHelp: function() {
        let helpIcon = St.Icon.new();
        let iconButton = St.Button.new();

        iconButton.child = helpIcon;

        this._layout.add(iconButton, { row: 0, col: 2, x_expand: false });

        helpIcon.icon_name = 'dialog-question-symbolic';
        helpIcon.icon_size = 16;
        helpIcon.style_class = 'help-icon';

        iconButton.connect('clicked', Lang.bind(this, function() {
            let dialog = new HelpDialog.HelpDialog();
            dialog.open();
            this._trayMenu.close();
        }));
    },

    _addEntry: function(content) {
        this._rtm.get('rtm.timelines.create', {}, Lang.bind(this, function(resp) {
            let options = { timeline: resp.rsp.timeline, name: content, parse: 1 };
            this._rtm.get('rtm.tasks.add', options, Lang.bind(this, function(resp) {
                if (resp.rsp.stat == 'ok') {
                    this._notifier.notify("Task successfully created", content);
                    this._taskList.refresh();
                } else {
                    this._notifier.notify("Failed to create the task", content);
                }
            }));
        }));
    }
});

// vim: ts=4 sw=4
