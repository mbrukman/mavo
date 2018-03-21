(function($, $$) {

Mavo.attributes.push("mv-action");

var _ = Mavo.Actions = {
	listener: evt => {
		var element = evt.target.closest("[mv-action]");

		if (element) {
			_.run(element.getAttribute("mv-action"), element);
		}
	},

	run: (code, element) => {
		if (code) {
			var node = Mavo.Node.getClosest(element);

			if (node) {
				var expression = new Mavo.Expression(code);
				return expression.eval(node.getLiveData(), {actions: true});
			}
		}
	},

	getNodes: ref => {
		var node = _.getNode(ref);

		if (node) {
			return [node];
		}

		return Mavo.toArray(ref).map(n => _.getNode(n)).filter(n => n !== undefined);
	},

	getNode: node => {
		if (node instanceof Mavo.Node) {
			return node;
		}
		else if (node && node[Mavo.toNode]) {
			return node[Mavo.toNode];
		}
	},

	Functions: {
		/**
		 * @param ref Collection to add to
		 * @param data (Optional) data of new item(s)
		 * @param index {Number} index of new item(s).
		 * @returns Newly added item(s)
		 */
		add: (ref, data, index) => {
			if (!ref) {
				return;
			}

			var nodes = _.getNodes(ref);

			return Mavo.flatten(nodes.map(node => {
				var collection = node.closestCollection;

				if (!collection) {
					return;
				}

				// If there is no index, get index from collection item
				if (index === undefined && !(node instanceof Mavo.Collection)) {
					index = node.closestItem.index;
				}

				var items = (Array.isArray(data)? data : [data]).map(datum => {
					var item = collection.add(undefined, index);

					if (datum !== undefined) {
						item.render(datum);
					}

					if (collection.editing) {
						collection.editItem(item);
					}

					return item.getLiveData();
				});

				return items;
			}).filter(n => n !== undefined));
		},

		/**
		 * @param from {Mavo.Node|Array<Mavo.Node>} one or more items to move
		 * @param to where to move to, item or collection. Optional
		 * @param index {Number} index. Optional
		 * @returns Moved item(s)
		 */
		move: (from, to, index) => {
			if (!from || to === undefined) {
				return;
			}

			if (Array.isArray(from)) {
				return from.map(f => _.Functions.move(f, to, index))
				           .filter(n => n !== undefined);
			}

			var toNode = _.getNode(to);

			if ($.type(to) == "number" && !(toNode && toNode.collection)) {
				// If to is a number and not a collection item, it's an index
				index = to;
				to = undefined;
			}

			var node = _.getNode(from);

			if (node.collection) {
				node.collection.delete(node, {silent: true});
				return _.Functions.add(to || node.collection, from, index);
			}
		},

		/**
		 * @param ref Items to delete
		 */
		clear: (...ref) => {
			if (!ref.length || !ref[0]) {
				return;
			}

			var nodes = _.getNodes(Mavo.flatten(ref));
			var itemsToDelete = [];

			nodes.forEach(node => {
				if (!node) {
					return;
				}

				if (node instanceof Mavo.Collection) {
					// Clear collection
					itemsToDelete.push(...node.children);
				}
				else if (node.collection) {
					// Collection item, delete
					itemsToDelete.push(node);
				}
				else {
					// Ordinary node, just clear its data
					node.walk(n => {
						if (n instanceof Mavo.Primitive) {
							n.value = null;
						}
						else if (n !== node) {
							_.clear(n);
						}
					});
				}
			});

			Mavo.Collection.delete(itemsToDelete);

			return nodes.map(n => n.getLiveData());
		},

		clearif: (condition, ...targets) => {
			targets = targets.map(t => Mavo.Functions.iff(condition, t));
			return _.Functions.clear(...targets);
		},

		/**
		 * Set node(s) to value(s)
		 * If ref is a single node, set it to values
		 * If ref is multiple nodes, set it to corresponding value
		 * If ref is multiple nodes and values is not an array, set all nodes to values
		 */
		set: (ref, values) => {
			if (!ref) {
				return;
			}

			var wasArray = Array.isArray(ref);
			var nodes = _.getNodes(ref);

			Mavo.Script.binaryOperation(wasArray? nodes : nodes[0], values, {
				scalar: (node, value) => node.render(value)
			});

			return values;
		}
	}
};

// Create *if() versions of data actions
for (let name in _.Functions) {
	let nameif = name + "if";

	if (!(nameif in _.Functions)) {
		_.Functions[nameif] = (condition, target, ...rest) => {
			target = Mavo.Functions.iff(condition, target);
			return _.Functions[name](target, ...rest);
		};
	}
}

_.Functions.deleteif = _.Functions.clearif;

})(Bliss, Bliss.$);
