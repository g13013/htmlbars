import { preprocess } from "htmlbars/parser";
import { ASTWalker } from "htmlbars/compiler/ast_walker";

module("ASTWalker");

test("visits ast in an order friendly to opcode generation", function () {
  var input = "A{{#if}}B{{#block}}C{{/block}}{{#block}}D{{/block}}{{else}}E{{#block}}F{{/block}}{{/if}}<div>G{{#block}}H{{/block}}</div>";
  var expected = "[0: [0: 'C' 1: 'D'] 'B{{0}}{{1}}' 1: [0: 'F'] 'E{{0}}' 2: 'H'] 'A{{0,1}}<div>G{{2}}</div>'";

  var ast = preprocess(input);

  var visitor = {
    opcodes: [],
    templateId: 0,
    startTemplate: function (childCount) {
      this.templateId = 0;
      this.opcodes.push(['startTemplate', childCount]);
    },
    endTemplate: function () {
      this.opcodes.push(['pushTemplate']);
    },
    openElement: function (element) {
      this.opcodes.push(['openTag', element.tag]);
    },
    text: function (str) {
      this.opcodes.push(['text', str]);
    },
    closeElement: function (element) {
      this.opcodes.push(['closeTag', element.tag]);
    },
    block: function (block) {
      this.opcodes.push(['block', this.templateId++, block.inverse === null ? null : this.templateId++]);
    },
    node: function (node) { }
  };

  var walker = new ASTWalker(visitor);
  walker.visit(ast);

  var compiler = {
    stack: [],
    template: null,
    startTemplate: function (childCount) {
      this.template = '';
      var childId = 0, child;
      if (childCount > 0) {
        this.template += '[';
        while (childCount--) {
          child = this.stack.pop();
          if (childId > 0) this.template += ' ';
          this.template += '' + childId++ + ': ' + child;
        }
        this.template += '] ';
      }
      this.template += "'";
    },
    pushTemplate: function () {
      this.template += "'";
      this.stack.push(this.template);
    },
    openTag: function (tag) {
      this.template += '<' + tag + '>';
    },
    closeTag: function (tag) {
      this.template += '</' + tag + '>';
    },
    text: function (str) {
      this.template += str;
    },
    block: function (programId, inverseId) {
      this.template += '{{' + programId;
      if (inverseId !== null) {
        this.template += ',' + inverseId;
      }

      this.template += '}}';
    },
    compile: function (opcodes) {
      var opcode;
      for (var i=0; i<opcodes.length; i++) {
        opcode = opcodes[i];
        this[opcode[0]].apply(this, opcode.slice(1));
      }
      return this.stack.pop();
    }
  };

  var output = compiler.compile(visitor.opcodes);

  equal(output, expected);
});
