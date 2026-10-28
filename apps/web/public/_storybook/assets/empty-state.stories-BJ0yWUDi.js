import{a6 as i,aU as c,j as e,B as r,C as m,e as l,f as u,S as y,P as h}from"./iframe-BjN4PNZi.js";import{I as g}from"./inbox-CXA9en-m.js";import{F as f}from"./folder-kanban-YNL2kew5.js";import"./preload-helper-PPVm8Dsz.js";const d={name:"search-x",size:24,node:[["path",{d:"m13.5 8.5-5 5",key:"1cs55j"}],["path",{d:"m8.5 8.5 5 5",key:"a8mexj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]]};d.node;const v=i(d);const p={name:"upload",size:24,node:[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]]};p.node;const x=i(p),k={title:"Feedback/EmptyState",component:c,tags:["autodocs"],args:{variant:"page",icon:e.jsx(f,{}),title:"No projects yet",description:"Projects group issues toward a goal with a target date. Create one to plan your next release.",primaryAction:e.jsx(r,{variant:"primary",icon:e.jsx(h,{}),children:"New project"}),secondaryAction:e.jsx(r,{variant:"ghost",children:"Learn more"})},argTypes:{variant:{control:"inline-radio",options:["page","compact"]},icon:{control:!1},primaryAction:{control:!1},secondaryAction:{control:!1}},parameters:{docs:{description:{component:"What to show when a view has nothing in it: say why and offer the next step. `page`\nfor an empty view, `compact` for an empty list inside a card, panel or popover."}}}},o={},t={args:{icon:e.jsx(g,{}),title:"You’re all caught up",description:"New notifications about issues you follow will show up here.",primaryAction:void 0,secondaryAction:void 0}},n={args:{variant:"compact",icon:e.jsx(v,{}),title:"No issues match these filters",description:"Try removing the “Assignee: me” filter.",primaryAction:e.jsx(r,{size:"sm",variant:"secondary",children:"Clear filters"}),secondaryAction:void 0}},s={args:{icon:void 0,variant:"compact",secondaryAction:void 0}},a={render:()=>e.jsxs(m,{className:"w-[28rem]",children:[e.jsx(l,{children:e.jsx(u,{children:"Backlog"})}),e.jsx(c,{variant:"compact",icon:e.jsx(x,{}),title:"The backlog is empty",description:"Create an issue or import from Jira, GitHub or a CSV file.",primaryAction:e.jsx(r,{size:"sm",variant:"primary",trailing:e.jsx(y,{keys:["C"]}),children:"New issue"}),secondaryAction:e.jsx(r,{size:"sm",variant:"ghost",children:"Import"})})]})},S=["Playground","Page","Compact","WithoutIcon","InCard"];o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:"{}",...o.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    icon: <Inbox />,
    title: "You’re all caught up",
    description: "New notifications about issues you follow will show up here.",
    primaryAction: undefined,
    secondaryAction: undefined
  }
}`,...t.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "compact",
    icon: <SearchX />,
    title: "No issues match these filters",
    description: "Try removing the “Assignee: me” filter.",
    primaryAction: <Button size="sm" variant="secondary">
        Clear filters
      </Button>,
    secondaryAction: undefined
  }
}`,...n.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    icon: undefined,
    variant: "compact",
    secondaryAction: undefined
  }
}`,...s.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-[28rem]">
      <CardHeader>
        <CardTitle>Backlog</CardTitle>
      </CardHeader>
      <EmptyState variant="compact" icon={<Upload />} title="The backlog is empty" description="Create an issue or import from Jira, GitHub or a CSV file." primaryAction={<Button size="sm" variant="primary" trailing={<Shortcut keys={["C"]} />}>
            New issue
          </Button>} secondaryAction={<Button size="sm" variant="ghost">
            Import
          </Button>} />
    </Card>
}`,...a.parameters?.docs?.source},description:{story:"An empty Backlog inside a card, with two ways out.",...a.parameters?.docs?.description}}};export{n as Compact,a as InCard,t as Page,o as Playground,s as WithoutIcon,S as __namedExportsOrder,k as default};
