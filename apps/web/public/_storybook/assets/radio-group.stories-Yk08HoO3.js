import{a6 as c,cj as r,j as e,ck as a,C as b,e as v,f as h,g as x,G as f,B as j}from"./iframe-BjN4PNZi.js";import{U as w}from"./users-CrbWFYk8.js";import"./preload-helper-PPVm8Dsz.js";const u={name:"globe",size:24,node:[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",key:"13o1zl"}],["path",{d:"M2 12h20",key:"9i4pu4"}]]};u.node;const y=c(u);const p={name:"lock",size:24,node:[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]]};p.node;const g=c(p),k={title:"Forms/RadioGroup",component:r,tags:["autodocs"],args:{orientation:"vertical",variant:"default",disabled:!1,defaultValue:"week","aria-label":"Cycle length"},argTypes:{orientation:{control:"inline-radio",options:["vertical","horizontal"]},variant:{control:"inline-radio",options:["default","card"]}},render:m=>e.jsxs(r,{...m,children:[e.jsx(a,{value:"week",label:"1 week"}),e.jsx(a,{value:"two-weeks",label:"2 weeks"}),e.jsx(a,{value:"month",label:"4 weeks"})]}),parameters:{docs:{description:{component:'One choice out of a few visible options. Use `variant="card"` when each option needs a\nsentence of explanation.'}}}},s={},o={args:{orientation:"horizontal"}},i={render:()=>e.jsxs(r,{defaultValue:"auto","aria-label":"Auto-archive",className:"w-80",children:[e.jsx(a,{value:"auto",label:"Auto-archive after 1 month",description:"Closed issues move to the archive 30 days after completion."}),e.jsx(a,{value:"quarter",label:"Auto-archive after 3 months",description:"Keeps a quarter of history visible in views."}),e.jsx(a,{value:"never",label:"Never",description:"Closed issues stay in views until archived manually."})]})},n={render:()=>e.jsxs(r,{variant:"card",defaultValue:"team","aria-label":"Visibility",className:"w-96",children:[e.jsx(a,{value:"private",icon:e.jsx(g,{}),label:"Private",description:"Only you can see this project."}),e.jsx(a,{value:"team",icon:e.jsx(w,{}),label:"Team",description:"Everyone in Engineering can view and edit."}),e.jsx(a,{value:"workspace",icon:e.jsx(y,{}),label:"Workspace",description:"All 142 members of Acme can view."})]})},l={render:()=>e.jsxs(r,{variant:"card",orientation:"horizontal",defaultValue:"scrum","aria-label":"Workflow template",className:"w-[560px]",children:[e.jsx(a,{value:"kanban",label:"Kanban",description:"Continuous flow, no cycles."}),e.jsx(a,{value:"scrum",label:"Cycles",description:"Two-week sprints with planning."}),e.jsx(a,{value:"triage",label:"Triage",description:"Inbox first, then assign."})]})},t={render:()=>e.jsxs("div",{className:"flex gap-10",children:[e.jsxs(r,{defaultValue:"a",disabled:!0,"aria-label":"Disabled group",children:[e.jsx(a,{value:"a",label:"Disabled, selected"}),e.jsx(a,{value:"b",label:"Disabled"})]}),e.jsxs(r,{defaultValue:"a","aria-label":"Partly disabled group",children:[e.jsx(a,{value:"a",label:"Available"}),e.jsx(a,{value:"b",label:"Enterprise plan only",disabled:!0})]})]})},d={render:()=>e.jsxs(b,{className:"w-[420px]",children:[e.jsx(v,{children:e.jsx(h,{children:"Issue estimates"})}),e.jsx(x,{children:e.jsxs(r,{defaultValue:"fibonacci","aria-label":"Estimate scale",children:[e.jsx(a,{value:"none",label:"Not in use"}),e.jsx(a,{value:"exponential",label:"Exponential",description:"1, 2, 4, 8, 16"}),e.jsx(a,{value:"fibonacci",label:"Fibonacci",description:"1, 2, 3, 5, 8"}),e.jsx(a,{value:"tshirt",label:"T-shirt sizes",description:"XS, S, M, L, XL"})]})}),e.jsx(f,{className:"justify-end",children:e.jsx(j,{variant:"primary",size:"sm",children:"Save"})})]})},I=["Playground","Horizontal","WithDescriptions","Cards","CardsHorizontal","States","InSettings"];s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    orientation: "horizontal"
  }
}`,...o.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <RadioGroup defaultValue="auto" aria-label="Auto-archive" className="w-80">
      <RadioGroupItem value="auto" label="Auto-archive after 1 month" description="Closed issues move to the archive 30 days after completion." />
      <RadioGroupItem value="quarter" label="Auto-archive after 3 months" description="Keeps a quarter of history visible in views." />
      <RadioGroupItem value="never" label="Never" description="Closed issues stay in views until archived manually." />
    </RadioGroup>
}`,...i.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <RadioGroup variant="card" defaultValue="team" aria-label="Visibility" className="w-96">
      <RadioGroupItem value="private" icon={<Lock />} label="Private" description="Only you can see this project." />
      <RadioGroupItem value="team" icon={<Users />} label="Team" description="Everyone in Engineering can view and edit." />
      <RadioGroupItem value="workspace" icon={<Globe />} label="Workspace" description="All 142 members of Acme can view." />
    </RadioGroup>
}`,...n.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <RadioGroup variant="card" orientation="horizontal" defaultValue="scrum" aria-label="Workflow template" className="w-[560px]">
      <RadioGroupItem value="kanban" label="Kanban" description="Continuous flow, no cycles." />
      <RadioGroupItem value="scrum" label="Cycles" description="Two-week sprints with planning." />
      <RadioGroupItem value="triage" label="Triage" description="Inbox first, then assign." />
    </RadioGroup>
}`,...l.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex gap-10">
      <RadioGroup defaultValue="a" disabled aria-label="Disabled group">
        <RadioGroupItem value="a" label="Disabled, selected" />
        <RadioGroupItem value="b" label="Disabled" />
      </RadioGroup>
      <RadioGroup defaultValue="a" aria-label="Partly disabled group">
        <RadioGroupItem value="a" label="Available" />
        <RadioGroupItem value="b" label="Enterprise plan only" disabled />
      </RadioGroup>
    </div>
}`,...t.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-[420px]">
      <CardHeader>
        <CardTitle>Issue estimates</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup defaultValue="fibonacci" aria-label="Estimate scale">
          <RadioGroupItem value="none" label="Not in use" />
          <RadioGroupItem value="exponential" label="Exponential" description="1, 2, 4, 8, 16" />
          <RadioGroupItem value="fibonacci" label="Fibonacci" description="1, 2, 3, 5, 8" />
          <RadioGroupItem value="tshirt" label="T-shirt sizes" description="XS, S, M, L, XL" />
        </RadioGroup>
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="primary" size="sm">
          Save
        </Button>
      </CardFooter>
    </Card>
}`,...d.parameters?.docs?.source}}};export{n as Cards,l as CardsHorizontal,o as Horizontal,d as InSettings,s as Playground,t as States,i as WithDescriptions,I as __namedExportsOrder,k as default};
