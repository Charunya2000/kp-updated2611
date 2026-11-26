const entitySchema = {
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  parentId: {
    type: String,
    required: false,
  },
  type: {
    type: String,
    required: true,
    enum: ['Basic', 'Function', 'Interface', 'Data'],
  },
  functionName: {
    type: String,
    required: function () {
      return this.type === 'Function';
    },
  },
};

module.exports = entitySchema;
