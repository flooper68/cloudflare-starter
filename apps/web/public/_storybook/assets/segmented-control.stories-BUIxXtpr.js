import{a6 as g,cl as a,j as e,cm as t,r as C}from"./iframe-BjN4PNZi.js";import{L as d,C as c}from"./list-B-g-f-Xg.js";import"./preload-helper-PPVm8Dsz.js";const p={name:"chart-no-axes-gantt",size:24,node:[["path",{d:"M6 5h12",key:"fvfigv"}],["path",{d:"M4 12h10",key:"oujl3d"}],["path",{d:"M12 19h8",key:"baeox8"}]],aliases:["gantt-chart"]};p.node;const m=g(p);const x={name:"rows-3",size:24,node:[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M21 9H3",key:"1338ky"}],["path",{d:"M21 15H3",key:"9uk58r"}]],aliases:["panels-top-bottom"]};x.node;const S=g(x),f={title:"Forms/SegmentedControl",component:a,tags:["autodocs"],args:{defaultValue:"list",size:"md",disabled:!1,"aria-label":"Layout"},argTypes:{size:{control:"inline-radio",options:["sm","md"]}},render:u=>e.jsxs(a,{...u,children:[e.jsx(t,{value:"list",icon:e.jsx(d,{}),children:"List"}),e.jsx(t,{value:"board",icon:e.jsx(c,{}),children:"Board"}),e.jsx(t,{value:"timeline",icon:e.jsx(m,{}),children:"Timeline"})]}),parameters:{docs:{description:{component:"Switch between a few views or modes. One segment is always selected; arrow keys move\nbetween segments. Icon-only segments need `label`."}}}},s={},o={args:{size:"sm"}},r={render:()=>e.jsxs(a,{defaultValue:"active","aria-label":"Issue filter",children:[e.jsx(t,{value:"all",children:"All issues"}),e.jsx(t,{value:"active",children:"Active"}),e.jsx(t,{value:"backlog",children:"Backlog"})]})},l={render:()=>e.jsxs(a,{defaultValue:"list",size:"sm","aria-label":"Density",children:[e.jsx(t,{value:"list",icon:e.jsx(d,{}),label:"List"}),e.jsx(t,{value:"compact",icon:e.jsx(S,{}),label:"Compact list"}),e.jsx(t,{value:"board",icon:e.jsx(c,{}),label:"Board"})]})},i={render:()=>e.jsxs(a,{defaultValue:"list","aria-label":"Layout",children:[e.jsx(t,{value:"list",icon:e.jsx(d,{}),children:"List"}),e.jsx(t,{value:"board",icon:e.jsx(c,{}),children:"Board"}),e.jsx(t,{value:"timeline",icon:e.jsx(m,{}),disabled:!0,children:"Timeline"})]})},n={render:function(){const[b,v]=C.useState("board");return e.jsxs("div",{className:"flex w-[520px] items-center justify-between rounded-lg border border-line bg-surface-raised px-3 py-2",children:[e.jsx("span",{className:"font-medium text-fg text-sm",children:"Engineering · Active issues"}),e.jsxs(a,{size:"sm",value:b,onValueChange:v,"aria-label":"Layout",children:[e.jsx(t,{value:"list",icon:e.jsx(d,{}),label:"List"}),e.jsx(t,{value:"board",icon:e.jsx(c,{}),label:"Board"}),e.jsx(t,{value:"timeline",icon:e.jsx(m,{}),label:"Timeline"})]})]})}},I=["Playground","Small","TextOnly","IconOnly","DisabledItem","InAViewHeader"];s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    size: "sm"
  }
}`,...o.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: () => <SegmentedControl defaultValue="active" aria-label="Issue filter">
      <SegmentedControlItem value="all">All issues</SegmentedControlItem>
      <SegmentedControlItem value="active">Active</SegmentedControlItem>
      <SegmentedControlItem value="backlog">Backlog</SegmentedControlItem>
    </SegmentedControl>
}`,...r.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <SegmentedControl defaultValue="list" size="sm" aria-label="Density">
      <SegmentedControlItem value="list" icon={<List />} label="List" />
      <SegmentedControlItem value="compact" icon={<Rows3 />} label="Compact list" />
      <SegmentedControlItem value="board" icon={<Columns3 />} label="Board" />
    </SegmentedControl>
}`,...l.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <SegmentedControl defaultValue="list" aria-label="Layout">
      <SegmentedControlItem value="list" icon={<List />}>
        List
      </SegmentedControlItem>
      <SegmentedControlItem value="board" icon={<Columns3 />}>
        Board
      </SegmentedControlItem>
      <SegmentedControlItem value="timeline" icon={<GanttChart />} disabled>
        Timeline
      </SegmentedControlItem>
    </SegmentedControl>
}`,...i.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [layout, setLayout] = useState("board");
    return <div className="flex w-[520px] items-center justify-between rounded-lg border border-line bg-surface-raised px-3 py-2">
        <span className="font-medium text-fg text-sm">
          Engineering · Active issues
        </span>
        <SegmentedControl size="sm" value={layout} onValueChange={setLayout} aria-label="Layout">
          <SegmentedControlItem value="list" icon={<List />} label="List" />
          <SegmentedControlItem value="board" icon={<Columns3 />} label="Board" />
          <SegmentedControlItem value="timeline" icon={<GanttChart />} label="Timeline" />
        </SegmentedControl>
      </div>;
  }
}`,...n.parameters?.docs?.source},description:{story:"In a view header, switching the layout of the issue list.",...n.parameters?.docs?.description}}};export{i as DisabledItem,l as IconOnly,n as InAViewHeader,s as Playground,o as Small,r as TextOnly,I as __namedExportsOrder,f as default};
