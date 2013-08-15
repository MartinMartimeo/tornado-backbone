#!/usr/bin/python
# -*- encoding: utf-8 -*-
"""

"""
import hashlib
from sqlalchemy.types import Integer, Numeric, String
from sqlalchemy.orm.interfaces import MANYTOMANY, MANYTOONE, ONETOMANY
from tornado.escape import json_encode
from tornado.web import RequestHandler

from ..helper.ModelWrapper import ModelWrapper
from . import _pepper as pepper

__author__ = 'Martin Martimeo <martin@martimeo.de>'
__date__ = '26.04.13 - 22:09'


class BaseHandler(RequestHandler):
    """
        Basic Blueprint for a sqlalchemy model
    """

    # noinspection PyMethodOverriding
    def initialize(self,
                   model,
                   api_url: str,
                   own_url: str,
                   table_name: str):
        """

        :param model: The Model for which this handler has been created
        :param api_url: Location of the restless Api
        :param own_url: Location of ourself
        :param table_name: How we named the collection
        """
        super().initialize()

        self.model = ModelWrapper(model)
        self.table_name = table_name

        self.api_url = api_url
        self.own_url = own_url

        self.hash = hashlib.md5()
        self.hash.update(self.api_url.encode("utf-8"))
        self.hash.update(self.own_url.encode("utf-8"))
        self.hash.update(("%u" % pepper).encode("utf-8"))

    def compute_etag(self):
        """
            Blueprints are pretty static, so they are aggresivly cached using etag

            :return:
        """
        return self.hash.hexdigest()

    def get(self, ftype=None):
        """
            GET request
        """

        # Code from us is pretty static
        self.set_etag_header()
        if self.check_etag_header():
            self.set_status(304)
            return

        # The type we requested
        ftype = self.get_argument('ftype', ftype)

        # Args to build model
        mwargs = {'urlRoot': self.api_url + "/" + self.model.__collectionname__,
                  'schema': {}}

        # Args to build collection
        cwargs = {'url': self.api_url + "/" + self.model.__collectionname__,
                  'model': "%sModel" % self.model.__collectionname__,
                  'name': self.model.__collectionname__}

        # Primary Keys
        l_primary_keys = list(self.model.primary_keys)
        if len(l_primary_keys) == 1:
            mwargs["idAttribute"] = l_primary_keys[0]
        else:
            mwargs["idAttributes"] = l_primary_keys

        # Columns
        for key, field in self.model.attributes.items():
            mwargs.setdefault("columnAttributes", []).append(field.key)
            mwargs['schema'][field.key] = {}
            mwargs['schema'][field.key].update(field.property.info)
            mwargs['schema'][field.key].update(field.info)
            if hasattr(field, "default") and field.default:
                mwargs.setdefault("defaults", {})[field.key] = "%s" % field.default.arg
            if hasattr(field, "type") and isinstance(field.type, Integer):
                mwargs['schema'][field.key].setdefault("type", "Text")
                mwargs['schema'][field.key].setdefault("dataType", "number")
                mwargs['schema'][field.key].setdefault("editorAttrs", {}).setdefault("step", "1.0")
            elif hasattr(field, "type") and isinstance(field.type, Numeric):
                mwargs['schema'][field.key].setdefault("type", "Text")
                mwargs['schema'][field.key].setdefault("dataType", "number")
                mwargs['schema'][field.key].setdefault("editorAttrs", {}).setdefault("step", "any")
            elif hasattr(field, "type") and isinstance(field.type, String):
                mwargs['schema'][field.key].setdefault("type", "Text")
            elif hasattr(field, "type"):
                mwargs['schema'][field.key].setdefault("type", "%s" % field.type.__class__.__name__)

        # Foreign Keys
        mwargs['relations'] = []
        for relation_key, relation in self.model.relations.items():
            relation_info = relation.info
            relation_info.setdefault('key', relation_key)

            # Get the local columns in this table
            local_columns = list(relation.property.local_columns)
            if len(local_columns) > 1:
                raise Exception("Can't handle multiple key columns for relation")
            local_column = local_columns[0]

            # Find our column in the mapping
            for key, column in self.model.columns.items():
                if column.name == local_column.key:
                    local_column = column
                    break
            else:
                raise Exception("Could not find local column name attr for relation: %s" % relation_key)
            relation_info.setdefault('keySource', local_column.key)
            relation_info.setdefault('foreignKey', local_column.name)

            # Model & Collection
            target = relation.property.target
            relation_info.setdefault('relatedModel', "%sModel" % target.__collectionname__)
            relation_info.setdefault('collectionType', "%sCollection" % target.__collectionname__)

            # HasMany / HasOne
            relation_info.setdefault('reverseRelation', {})
            if relation.property.direction is MANYTOMANY or relation.property.direction is MANYTOONE:
                relation_info.setdefault('type', 'HasMany')
            else:
                relation_info.setdefault('type', 'HasOne')

            if relation.property.direction is MANYTOMANY or relation.property.direction is ONETOMANY:
                relation_info['reverseRelation'].setdefault('type', 'HasMany')
            else:
                relation_info['reverseRelation'].setdefault('type', 'HasOne')

            mwargs['schema'].setdefault(relation_key, {}).update({'type': 'NestedModel', 'model': '%sModel' % target.__collectionname__})
            mwargs['relations'].append(relation_info)

        if ftype == "json":
            self.set_header("Content-Type", "application/json; charset=UTF-8")
            self.write({cwargs["model"]: mwargs, '%sCollection' % cwargs["name"]: cwargs})
        else:
            self.set_header("Content-Type", "application/javascript; charset=UTF-8")
            self.write('var %s = Tornado.Model.extend(%s);' % (cwargs["model"], json_encode(mwargs)))
            self.write('var %sCollection = Tornado.Collection.extend(%s);' % (cwargs["name"], json_encode(cwargs)))
            self.write('%s = new %sCollection;' % (self.table_name, cwargs["name"]))






