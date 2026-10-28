import{a6 as o,c0 as a,j as e,c1 as n,B as r,c2 as c,c3 as l,p as i}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const s={name:"calendar-clock",size:24,node:[["path",{d:"M16 14v2.2l1.6 1",key:"fo4ql5"}],["path",{d:"M16 2v3",key:"otl347"}],["path",{d:"M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338",key:"7hb8p4"}],["path",{d:"M3 9h5.859",key:"numkqi"}],["path",{d:"M8 2v3",key:"1ioesn"}],["circle",{cx:"16",cy:"16",r:"6",key:"qoo3c4"}]]};s.node;const d=o(s),u={title:"Overlays/Popover",component:a,tags:["autodocs"],parameters:{docs:{description:{component:"A floating panel anchored to its trigger. Menus and pickers are built on it."}}}},t={render:()=>e.jsx("div",{className:"h-64",children:e.jsxs(a,{defaultOpen:!0,children:[e.jsx(n,{asChild:!0,children:e.jsx(r,{icon:e.jsx(d,{}),children:"Estimate"})}),e.jsx(c,{children:e.jsxs("div",{className:"flex flex-col gap-2",children:[e.jsx(l,{htmlFor:"estimate",children:"Estimate (hours)"}),e.jsx(i,{id:"estimate",defaultValue:"4"}),e.jsx("p",{className:"text-xs text-fg-subtle",children:"Used for cycle capacity."})]})})]})})},h=["Open"];t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: () => <div className="h-64">
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button icon={<CalendarClock />}>Estimate</Button>
        </PopoverTrigger>
        <PopoverContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="estimate">Estimate (hours)</Label>
            <Input id="estimate" defaultValue="4" />
            <p className="text-xs text-fg-subtle">Used for cycle capacity.</p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
}`,...t.parameters?.docs?.source}}};export{t as Open,h as __namedExportsOrder,u as default};
