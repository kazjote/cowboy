const Lang = imports.lang;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const PopupMenu = imports.ui.popupMenu;

const TaskList = new Lang.Class({
    Name: 'TaskList',

    //// Public methods ////

    _init: function(menu, authenticator, rtm, notifier) {
        this._menu = menu;
        this._authenticator = authenticator;
        this._rtm = rtm;
        this._notifier = notifier;
        this._menu_items = [];
    },


    // It will use last filter when called without arguments
    refresh: function(filter) {
        if(filter !== undefined) {
            this._last_filter = filter;
        }

        if(this._last_filter) {
            let filter = this._last_filter + ' status:incomplete';

            this._authenticator.authenticated(Lang.bind(this, function() {
                this._rtm.get('rtm.tasks.getList', { filter: filter }, Lang.bind(this, function(resp) {
                    if(resp.rsp.stat == 'ok') {
                        this._recreate(resp.rsp.tasks.list);
                    }
                    return null;
                }));
            }));
        }
    },

    //// Private methods ////

    _add_task: function(list, taskSerie, task) {
        let menu_item = new PopupMenu.PopupSubMenuMenuItem(taskSerie.name);

        let [_, _, _, tasksInstalled] =
            GLib.spawn_sync(null, ['which', 'cowboy_tasks'], null, GLib.SpawnFlags.SEARCH_PATH, null);

        if(tasksInstalled == 0) {
            menu_item.menu.addAction('Details', function() {
                let [res, pid, in_fd, out_fd, err_fd] = GLib.spawn_async_with_pipes(null, ['cowboy_tasks'], null, GLib.SpawnFlags.SEARCH_PATH, null);

                let in_writer = new Gio.DataOutputStream({
                    base_stream: new Gio.UnixOutputStream({fd: in_fd})
                });

                let json = JSON.stringify({
                    'name': taskSerie.name,
                    'url': taskSerie.url,
                    'tags': taskSerie.tags,
                    'notes': taskSerie.notes.note,
                    'due': task.due,
                    'priority': task.priority,
                    'estimate': task.estimate
                });

                // log(json);

                in_writer.put_string(json + '\n', null);
            });
        }

        menu_item.menu.addAction('Complete', Lang.bind(this, function() {
            this._authenticator.authenticated(Lang.bind(this, function() {
                this._rtm.get('rtm.timelines.create', {}, Lang.bind(this, function(resp) {
                    let options = {
                        timeline: resp.rsp.timeline,
                        list_id: list.id,
                        taskseries_id: taskSerie.id,
                        task_id: task.id
                    };
                    this._rtm.get('rtm.tasks.complete', options, Lang.bind(this, function(resp) {
                        this.refresh();
                        this._notifier.notify('Task completed', 'Task ' + taskSerie.name + ' has been marked as completed');
                    }))
                }));
            }));
        }));

        this._menu_items.push(menu_item);
        this._menu.addMenuItem(menu_item);
    },

    _add_task_serie: function(list, taskSerie) {
        if(taskSerie.task.length === undefined) {
            this._add_task(list, taskSerie, taskSerie.task);
        } else {
            for (let i = 0; i < taskSerie.task.length; i += 1) {
                this._add_task(list, taskSerie, taskSerie.task[i]);
            };
        }
    },

    _recreate: function(lists) {
        this._menu_items.forEach(function(menu_item) {
            menu_item.destroy();
        });

        this._menu_items = [];

        if(lists === undefined) { return null; }

        for(let i = 0; i < lists.length; i += 1) {

            let list = lists[i];
            let taskSeries = lists[i].taskseries;

            // When there is only one task, taskseries is just a hash with this task
            //
            // When there are more tasks, it is an array
            if(taskSeries.length === undefined) {
                this._add_task_serie(list, taskSeries);
            } else {
                for(let j = 0; j < taskSeries.length; j += 1) {
                    this._add_task_serie(list, taskSeries[j]);
                }
            }
        }

        return null;
    }
});

// vim: ts=4 sw=4
