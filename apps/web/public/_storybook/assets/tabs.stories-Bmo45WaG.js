import{a6 as T,cf as n,j as e,cg as i,ch as s,ci as r}from"./iframe-BjN4PNZi.js";import{L as u,C as b}from"./list-B-g-f-Xg.js";import"./preload-helper-PPVm8Dsz.js";const g={name:"map",size:24,node:[["path",{d:"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",key:"169xi5"}],["path",{d:"M15 5.764v15",key:"1pn4in"}],["path",{d:"M9 3.236v15",key:"1uimfh"}]]};g.node;const v=T(g),h={title:"Navigation/Tabs",component:n,tags:["autodocs"],args:{variant:"underline",size:"md"},argTypes:{variant:{control:"inline-radio",options:["underline","pill"]},size:{control:"inline-radio",options:["sm","md"]}},parameters:{docs:{description:{component:"Switch between views of the same thing. `underline` for page sections (Overview /\nIssues / Updates), `pill` (segmented) for compact view switches in a toolbar. Arrow\nkeys move between tabs."}}}},t={render:a=>e.jsxs(i,{defaultValue:"issues",className:"w-[480px]",children:[e.jsxs(n,{...a,children:[e.jsx(s,{value:"overview",children:"Overview"}),e.jsx(s,{value:"issues",count:32,children:"Issues"}),e.jsx(s,{value:"updates",count:4,children:"Updates"}),e.jsx(s,{value:"settings",disabled:!0,children:"Settings"})]}),e.jsx(r,{value:"overview",className:"text-sm text-fg-muted",children:"Mobile app v3 ships offline sync and a new tablet layout."}),e.jsx(r,{value:"issues",className:"text-sm text-fg-muted",children:"32 issues, 14 done."}),e.jsx(r,{value:"updates",className:"text-sm text-fg-muted",children:"Latest update: “Offline sync slipped a week.”"})]})},l={render:()=>e.jsx("div",{className:"flex flex-col gap-6",children:["sm","md"].map(a=>e.jsx(i,{defaultValue:"all",children:e.jsxs(n,{size:a,children:[e.jsx(s,{value:"all",children:"All issues"}),e.jsx(s,{value:"active",children:"Active"}),e.jsx(s,{value:"backlog",children:"Backlog"})]})},a))})},d={render:()=>e.jsx("div",{className:"flex flex-col gap-4",children:["sm","md"].map(a=>e.jsx(i,{defaultValue:"list",children:e.jsxs(n,{variant:"pill",size:a,children:[e.jsx(s,{value:"list",icon:e.jsx(u,{}),children:"List"}),e.jsx(s,{value:"board",icon:e.jsx(b,{}),children:"Board"}),e.jsx(s,{value:"timeline",icon:e.jsx(v,{}),children:"Timeline"})]})},a))})},o={render:()=>e.jsx(i,{defaultValue:"assigned",children:e.jsxs(n,{variant:"pill",children:[e.jsx(s,{value:"assigned",count:12,children:"Assigned"}),e.jsx(s,{value:"created",count:48,children:"Created"}),e.jsx(s,{value:"subscribed",count:3,children:"Subscribed"})]})})},c={render:()=>e.jsx("div",{className:"w-[640px] rounded-lg border border-line bg-surface",children:e.jsxs(i,{defaultValue:"issues",className:"gap-0",children:[e.jsxs("div",{className:"flex items-center justify-between px-4",children:[e.jsxs(n,{className:"border-b-0",children:[e.jsx(s,{value:"overview",children:"Overview"}),e.jsx(s,{value:"issues",count:32,children:"Issues"}),e.jsx(s,{value:"updates",children:"Updates"})]}),e.jsx(i,{defaultValue:"list",children:e.jsxs(n,{variant:"pill",size:"sm",children:[e.jsx(s,{value:"list","aria-label":"List view",children:e.jsx(u,{})}),e.jsx(s,{value:"board","aria-label":"Board view",children:e.jsx(b,{})})]})})]}),e.jsxs("div",{className:"border-t border-line p-4 text-sm text-fg-muted",children:[e.jsx(r,{value:"overview",children:"Project brief and milestones."}),e.jsx(r,{value:"issues",children:"The issue list for this project."}),e.jsx(r,{value:"updates",children:"Weekly project updates."})]})]})})},j=["Playground","Underline","Pill","WithCounts","InContext"];t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: args => <Tabs defaultValue="issues" className="w-[480px]">
      <TabsList {...args}>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="issues" count={32}>
          Issues
        </TabsTrigger>
        <TabsTrigger value="updates" count={4}>
          Updates
        </TabsTrigger>
        <TabsTrigger value="settings" disabled>
          Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-sm text-fg-muted">
        Mobile app v3 ships offline sync and a new tablet layout.
      </TabsContent>
      <TabsContent value="issues" className="text-sm text-fg-muted">
        32 issues, 14 done.
      </TabsContent>
      <TabsContent value="updates" className="text-sm text-fg-muted">
        Latest update: “Offline sync slipped a week.”
      </TabsContent>
    </Tabs>
}`,...t.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-6">
      {(["sm", "md"] as const).map(size => <Tabs key={size} defaultValue="all">
          <TabsList size={size}>
            <TabsTrigger value="all">All issues</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="backlog">Backlog</TabsTrigger>
          </TabsList>
        </Tabs>)}
    </div>
}`,...l.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-4">
      {(["sm", "md"] as const).map(size => <Tabs key={size} defaultValue="list">
          <TabsList variant="pill" size={size}>
            <TabsTrigger value="list" icon={<ListIcon />}>
              List
            </TabsTrigger>
            <TabsTrigger value="board" icon={<Columns3 />}>
              Board
            </TabsTrigger>
            <TabsTrigger value="timeline" icon={<MapIcon />}>
              Timeline
            </TabsTrigger>
          </TabsList>
        </Tabs>)}
    </div>
}`,...d.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <Tabs defaultValue="assigned">
      <TabsList variant="pill">
        <TabsTrigger value="assigned" count={12}>
          Assigned
        </TabsTrigger>
        <TabsTrigger value="created" count={48}>
          Created
        </TabsTrigger>
        <TabsTrigger value="subscribed" count={3}>
          Subscribed
        </TabsTrigger>
      </TabsList>
    </Tabs>
}`,...o.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <div className="w-[640px] rounded-lg border border-line bg-surface">
      <Tabs defaultValue="issues" className="gap-0">
        <div className="flex items-center justify-between px-4">
          <TabsList className="border-b-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="issues" count={32}>
              Issues
            </TabsTrigger>
            <TabsTrigger value="updates">Updates</TabsTrigger>
          </TabsList>
          <Tabs defaultValue="list">
            <TabsList variant="pill" size="sm">
              <TabsTrigger value="list" aria-label="List view">
                <ListIcon />
              </TabsTrigger>
              <TabsTrigger value="board" aria-label="Board view">
                <Columns3 />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="border-t border-line p-4 text-sm text-fg-muted">
          <TabsContent value="overview">
            Project brief and milestones.
          </TabsContent>
          <TabsContent value="issues">
            The issue list for this project.
          </TabsContent>
          <TabsContent value="updates">Weekly project updates.</TabsContent>
        </div>
      </Tabs>
    </div>
}`,...c.parameters?.docs?.source}}};export{c as InContext,d as Pill,t as Playground,l as Underline,o as WithCounts,j as __namedExportsOrder,h as default};
