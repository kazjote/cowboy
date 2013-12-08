const Lang = imports.lang;
const St = imports.gi.St;

const TaskList = new Lang.Class({
    Name: 'TaskList',

    //// Public methods ////

    _init: function(container, authenticator, rtm) {
        this._container = container;
        this._authenticator = authenticator;
        this._rtm = rtm;
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

    _recreate: function(lists) {
        let children = this._container.get_children();

        for ( let i = 0; i < children.length; i += 1 ) {
            this._container.remove_actor(children[i]);
        }

        if(lists === undefined) { return null; }

        for(let i = 0; i < lists.length; i += 1) {

            let taskSeries = lists[i].taskseries;

            // When there is only one task, taskseries is just a hash with this task
            //
            // When there are more tasks, it is an array
            if(taskSeries.length === undefined) {
                this._add_task(taskSeries);
            } else {
                for(let j = 0; j < taskSeries.length; j += 1) {
                    this._add_task(taskSeries[j]);
                }
            }
        }

        return null;
    },

    _add_task: function(taskSerie) {
        let actionLabel = new St.Label({ text: taskSerie.name, style_class: 'task' });

        this._container.add_actor(actionLabel);
    }
});

// vim: ts=4 sw=4