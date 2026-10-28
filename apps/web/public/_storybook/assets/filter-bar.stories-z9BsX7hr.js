import{bE as a,j as e,r as u,bF as m,B as f,bv as h}from"./iframe-BjN4PNZi.js";import{f as g,i as v,a as y}from"./fixtures-CW67wZDI.js";import{S as x}from"./sliders-horizontal-DnySrMd3.js";import"./preload-helper-PPVm8Dsz.js";import"./circle-dashed-Divtlg0F.js";import"./signal-high-Dzb6_NUQ.js";import"./tag-D81nTkkR.js";import"./settings-ULeVwmos.js";import"./user-plus-DQ5D-oOB.js";import"./inbox-CXA9en-m.js";import"./layers-syhRhF9-.js";import"./copy-DjBACZ_m.js";const _={title:"Patterns/FilterBar",component:a,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'Linear-style filter chips: property → operator → values. "Filter" opens a searchable list\nof properties, then that property\'s values (multi-select, Backspace goes back). Click any\npart of a chip to change it, × to remove it. Controlled through `value`/`onValueChange`;\n`matchesFilters(item, filters, get)` applies them.'}}},args:{properties:g},argTypes:{properties:{control:!1}}},F=[{id:"f-status",property:"status",operator:"is",values:["in_progress","todo"]},{id:"f-assignee",property:"assignee",operator:"is",values:["u-ada"]},{id:"f-priority",property:"priority",operator:"is",values:["urgent"]}],o={render:r=>e.jsx("div",{className:"bg-surface",children:e.jsx(a,{...r,defaultValue:F})})},i={render:r=>e.jsx("div",{className:"bg-surface",children:e.jsx(a,{...r})})},s={parameters:{docs:{story:{height:"360px"}}},render:r=>e.jsx("div",{className:"h-96 bg-surface",children:e.jsx(a,{...r,defaultOpen:!0})})},t={render:function(l){const[n,p]=u.useState([{id:"f-1",property:"priority",operator:"is_not",values:["none","low"]}]),c=v.filter(d=>m(d,n,y));return e.jsxs("div",{className:"flex h-dvh flex-col bg-surface",children:[e.jsx(a,{...l,value:n,onValueChange:p,actions:e.jsx(f,{variant:"secondary",size:"sm",icon:e.jsx(x,{}),children:"Display"})}),e.jsx("div",{className:"min-h-0 flex-1 overflow-y-auto",children:e.jsx(h,{issues:c})})]})}},z=["Playground","Empty","Open","WithIssueList"];o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: args => <div className="bg-surface">
      <FilterBar {...args} defaultValue={preset} />
    </div>
}`,...o.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: args => <div className="bg-surface">
      <FilterBar {...args} />
    </div>
}`,...i.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    docs: {
      story: {
        height: "360px"
      }
    }
  },
  render: args => <div className="h-96 bg-surface">
      <FilterBar {...args} defaultOpen />
    </div>
}`,...s.parameters?.docs?.source},description:{story:'The "+ Filter" popover open on load.',...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: function Render(args) {
    const [filters, setFilters] = useState<readonly Filter[]>([{
      id: "f-1",
      property: "priority",
      operator: "is_not",
      values: ["none", "low"]
    }]);
    const shown = issues.filter(i => matchesFilters(i, filters, issueProperty));
    return <div className="flex h-dvh flex-col bg-surface">
        <FilterBar {...args} value={filters} onValueChange={setFilters} actions={<Button variant="secondary" size="sm" icon={<SlidersHorizontal />}>
              Display
            </Button>} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <IssueList issues={shown} />
        </div>
      </div>;
  }
}`,...t.parameters?.docs?.source},description:{story:"Filters applied to an issue list, with a Display button on the right.",...t.parameters?.docs?.description}}};export{i as Empty,s as Open,o as Playground,t as WithIssueList,z as __namedExportsOrder,_ as default};
