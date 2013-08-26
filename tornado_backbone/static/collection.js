/**
 * User: Martin Martimeo
 * Date: 18.08.13
 * Time: 14:58
 *
 * Add filtered collection in html
 */

require(["jquery", "underscore", "backbone"],function ($, _, Backbone) {
    var self = this.Tornado || {};
    var Tornado = this.Tornado = self;

    Tornado.BackboneCollection = Backbone.View.extend({

        initialize: function () {

            // Set collection
            if (this.options.collection) {
                if (_.isString(this.options.collection)) {
                    this.collection = this.options.collection = new window[this.options.collection]();
                } else {
                    this.collection = this.options.collection;
                }
            }

            // Create Template (@TODO there must be something better than unescaping the escaped < & > tags)
            this.template = _.template(this.$el.html().replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
            this.$el.empty();

            // Listen to model events
            this.listenTo(this.collection, 'all', this.handleEvent);

        },

        handleEvent: function (event) {
            var self = this,
                collection = this.collection;

            if ((event == "hide" || event == "show") && arguments[1]) {
                var model = arguments[1];
                var $el = self.$el.find("> [name='" + model.id + "']");
                $el[event]();
            }

            if (event == "reset") {
                this.$el.empty();
                this.render({reset: true});
            }
        },

        render: function (options) {
            var $el = this.$el,
                self = this,
                collection = this.collection;

            options = _.extend(this.options, options || {});

            if (collection.length > 0 || options.reset) {
                self.renderElements(options);
                self.renderFooter(options);
            } else {
                collection.fetch({
                    success: function () {
                        self.renderElements(options);
                        self.renderFooter(options);
                    }
                });
            }

            //Set the main element
            self.setElement($el);

            //Set class
            $el.addClass(self.className);

            return self;
        },

        search: function () {
            var self = this,
                collection = this.collection;

            // @TODO Implement this!

            return self;
        },

        renderElements: function (options) {
            var self = this,
                collection = this.collection;

            collection.each(function (model) {
                var $el = self.$el.find("> [name='" + model.id + "']");
                if ($el.length == 0) {
                    $el = $("<div></div>");
                    $el.attr("name", model.id);
                    self.$el.prepend($el);
                }
                $el.html(self.template(model.attributes));
            });
        },

        /**
         * Renders the pagination layer
         *
         * Inspired by https://gist.github.com/io41/838460
         * @param options
         */
        renderFooter: function (options) {
            var self = this,
                collection = this.collection;

            var info = {
                page: this.collection.page || 1,
                page_length: this.collection.page_length,
                pages: Math.ceil(this.collection.num_results / this.collection.page_length)
            };

            var $footer = self.$el.find("footer");
            if ($footer.length) {
                $footer.replaceWith(self.constructor.footerTemplate(info));
            } else {
                $footer = self.$el.append(self.constructor.footerTemplate(info));
            }

            if (info.page < 2) {
                $footer.find(".btn-fast-backward").addClass("disabled");
                $footer.find(".btn-step-backward").addClass("disabled");
            } else if (info.page < 3) {
                $footer.find(".btn-fast-backward").addClass("disabled");
            }

            if (info.page > info.total - 2) {
                $footer.find(".btn-fast-forward").addClass("disabled");
                $footer.find(".btn-step-forward").addClass("disabled");
            } else if (info.page > info.total - 3) {
                $footer.find(".btn-fast-forward").addClass("disabled");
            }
        }

    }, {
        /* STATICS */

        footerTemplate: _.template('\
            <footer>\
              <a class="btn btn-page btn-fast-backward"><i class="glyphicon glyphicon-fast-backward"></i></a>\
              <a class="btn btn-page btn-step-backward"><i class="glyphicon glyphicon-step-backward"></i></a>\
              <% if (page > 1) { %><a class="btn btn-page btn-page-number">1</a><% } %>\
              <% if (page >= 6) { %><span class="btn btn-page btn-page-ellipses">...</span><% } %>\
              <% if (page == 5) { %><a class="btn btn-page btn-page-number">2</a><% } %>\
              <% if (page > 3) { %><a class="btn btn-page btn-page-number"><%= (page-2) %></a><% } %>\
              <% if (page > 2) { %><a class="btn btn-page btn-page-number"><%= (page-1) %></a><% } %>\
              <a class="btn btn-page btn-page-number btn-page-active"><%= page %></a>\
              <% if (page < pages-1) { %><a class="btn btn-page btn-page-number"><%= (page+1) %></a><% } %>\
              <% if (page < pages-2) { %><a class="btn btn-page btn-page-number"><%= (page+2) %></a><% } %>\
              <% if (page == pages-3) { %><a class="btn btn-page btn-page-number"><%= (pages-1) %></a><% } %>\
              <% if (page <= pages-4) { %><span class="btn btn-page btn-page-ellipses">...</span><% } %>\
              <% if (page < pages) { %><a class="btn btn-page btn-page-number"><%= (pages) %></a><% } %>\
              <a class="btn btn-page btn-step-forward"><i class="glyphicon glyphicon-step-forward"></i></a>\
              <a class="btn btn-page btn-fast-forward"><i class="glyphicon glyphicon-fast-forward"></i></a>\
            </footer>\
        ')
    });

    /**
     * Allows to facility html elements with backbone-forms or model functionality
     *
     * @param option
     */
    $.fn.tbcollection = function (option) {
        var args = Array.prototype.slice.call(arguments, 1);

        return this.each(function () {
            var $this = $(this);
            var data = $this.data('tb.collection');

            var options = typeof option == 'object' && option;

            if (!data) {
                options["el"] = $this;
                $this.data('tb.collection', (data = new Tornado.BackboneCollection(options)));
                $this.data('tb.collection').render();
            }
            if (typeof option == 'string') {
                data[option].apply(data, args);
            }
        });
    };
    $.fn.tbcollection.Constructor = Tornado.BackboneCollection;

    // Facile elements with backbone-forms
    $('[data-collection][data-require]').each(function () {
        var $view = $(this);

        require($(this).data('require').split(" "), function () {
            $view.tbcollection($view.data())
        });
    });
    $('[data-collection]:not([data-require])').each(function () {
        var $view = $(this);
        $view.tbcollection($view.data());
    });

    return Tornado;
}).call(window);
