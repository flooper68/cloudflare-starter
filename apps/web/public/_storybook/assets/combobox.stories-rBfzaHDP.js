import{n as r,r as x,j as e,F as s,C as w,e as y,f as N,g as F,h as L}from"./iframe-BjN4PNZi.js";import{H as h}from"./hash-BA9V96Ja.js";import{B as u,L as m}from"./layers-syhRhF9-.js";import"./preload-helper-PPVm8Dsz.js";const j=[{value:"mobile-v3",label:"Mobile app v3",icon:e.jsx(u,{}),group:"Engineering"},{value:"sync",label:"Sync engine rewrite",icon:e.jsx(u,{}),group:"Engineering"},{value:"api-v2",label:"Public API v2",icon:e.jsx(u,{}),group:"Engineering"},{value:"onboarding",label:"Onboarding refresh",icon:e.jsx(m,{}),group:"Design"},{value:"brand",label:"Brand guidelines",icon:e.jsx(m,{}),group:"Design"},{value:"pricing",label:"Pricing page experiment",icon:e.jsx(m,{}),group:"Design",disabled:!0,description:"Archived"}],C=["Ada Lovelace","Grace Hopper","Linus Torvalds","Margaret Hamilton","Ken Thompson","Barbara Liskov"].map(a=>({value:a.toLowerCase().replace(/\s/g,"-"),label:a,icon:e.jsx(L,{name:a,size:"xs"}),description:`${a.split(" ")[0]?.toLowerCase()}@acme.dev`})),E={title:"Forms/Combobox",component:r,tags:["autodocs"],args:{options:j,placeholder:"Add to project",searchPlaceholder:"Search projects…",size:"md",disabled:!1,deselectable:!0,"aria-label":"Project"},argTypes:{size:{control:"inline-radio",options:["sm","md","lg"]},options:{control:!1}},decorators:[a=>e.jsx("div",{className:"w-72",children:e.jsx(a,{})})],parameters:{docs:{description:{component:'Searchable single select (cmdk in a Popover). Type to filter, arrows to move, Enter to\npick, Escape to close. `onCreate` adds a "Create …" row when nothing matches.'}}}},n={},t={args:{defaultOpen:!0,defaultValue:"sync"},decorators:[a=>e.jsx("div",{className:"h-96",children:e.jsx(a,{})})]},c={args:{options:C,placeholder:"Assign to…",searchPlaceholder:"Search people…",defaultValue:"grace-hopper","aria-label":"Assignee"}},i={render:a=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(r,{...a,size:"sm"}),e.jsx(r,{...a,size:"md"}),e.jsx(r,{...a,size:"lg"})]})},d={render:a=>e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsx(s,{label:"Disabled",children:e.jsx(r,{...a,disabled:!0,defaultValue:"api-v2"})}),e.jsx(s,{label:"No options",children:e.jsx(r,{...a,options:[],emptyText:"No projects yet"})}),e.jsx(s,{label:"Project",error:"Pick a project for this milestone",children:e.jsx(r,{...a})})]})},l={render:function(){const[v,f]=x.useState(["Bug","Feature","Improvement","Performance"].map(o=>({value:o.toLowerCase(),label:o,icon:e.jsx(h,{})}))),[S,b]=x.useState("bug");return e.jsx(s,{label:"Label",description:"Type a new name to create a label.",children:e.jsx(r,{options:v,value:S,onValueChange:b,placeholder:"Add label",searchPlaceholder:"Search or create…",onCreate:o=>{const g={value:o.toLowerCase(),label:o,icon:e.jsx(h,{})};f(P=>[...P,g]),b(g.value)},createLabel:o=>e.jsxs(e.Fragment,{children:["Create label ",e.jsxs("span",{className:"font-medium",children:['"',o,'"']})]})})})}},p={render:()=>e.jsxs(w,{className:"w-96",children:[e.jsx(y,{children:e.jsx(N,{children:"New milestone"})}),e.jsxs(F,{className:"flex flex-col gap-3",children:[e.jsx(s,{label:"Project",children:e.jsx(r,{options:j,placeholder:"Choose a project",defaultValue:"mobile-v3"})}),e.jsx(s,{label:"Owner",optional:!0,children:e.jsx(r,{options:C,placeholder:"Assign an owner",searchPlaceholder:"Search people…"})})]})]})},H=["Playground","Open","People","Sizes","States","CreateNew","InAForm"];n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    defaultOpen: true,
    defaultValue: "sync"
  },
  decorators: [Story => <div className="h-96">
        <Story />
      </div>]
}`,...t.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    options: people,
    placeholder: "Assign to…",
    searchPlaceholder: "Search people…",
    defaultValue: "grace-hopper",
    "aria-label": "Assignee"
  }
}`,...c.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex flex-col gap-3">
      <Combobox {...args} size="sm" />
      <Combobox {...args} size="md" />
      <Combobox {...args} size="lg" />
    </div>
}`,...i.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex flex-col gap-4">
      <Field label="Disabled">
        <Combobox {...args} disabled defaultValue="api-v2" />
      </Field>
      <Field label="No options">
        <Combobox {...args} options={[]} emptyText="No projects yet" />
      </Field>
      <Field label="Project" error="Pick a project for this milestone">
        <Combobox {...args} />
      </Field>
    </div>
}`,...d.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [labels, setLabels] = useState<ComboboxOption[]>(["Bug", "Feature", "Improvement", "Performance"].map(label => ({
      value: label.toLowerCase(),
      label,
      icon: <Hash />
    })));
    const [value, setValue] = useState<string | null>("bug");
    return <Field label="Label" description="Type a new name to create a label.">
        <Combobox options={labels} value={value} onValueChange={setValue} placeholder="Add label" searchPlaceholder="Search or create…" onCreate={query => {
        const created = {
          value: query.toLowerCase(),
          label: query,
          icon: <Hash />
        };
        setLabels(current => [...current, created]);
        setValue(created.value);
      }} createLabel={query => <>
              Create label <span className="font-medium">"{query}"</span>
            </>} />
      </Field>;
  }
}`,...l.parameters?.docs?.source},description:{story:'Type a label that does not exist (e.g. "Regression") and press Enter to create it.',...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-96">
      <CardHeader>
        <CardTitle>New milestone</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field label="Project">
          <Combobox options={projects} placeholder="Choose a project" defaultValue="mobile-v3" />
        </Field>
        <Field label="Owner" optional>
          <Combobox options={people} placeholder="Assign an owner" searchPlaceholder="Search people…" />
        </Field>
      </CardContent>
    </Card>
}`,...p.parameters?.docs?.source}}};export{l as CreateNew,p as InAForm,t as Open,c as People,n as Playground,i as Sizes,d as States,H as __namedExportsOrder,E as default};
