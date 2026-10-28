import{l as a,r as b,j as e,C as x,e as C,f as k,m as g,g as f}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const v={title:"Forms/Checkbox",component:a,tags:["autodocs"],args:{label:"Notify subscribers",disabled:!1},argTypes:{checked:{control:"inline-radio",options:[!0,!1,"indeterminate"]}},parameters:{docs:{description:{component:'A checkbox for choices submitted with a form. `checked="indeterminate"` shows a dash, for\na "select all" whose children are partly selected.'}}}},r={},l={args:{label:"Create sub-issues automatically",description:"Split checklist items in the description into sub-issues.",defaultChecked:!0}},n={render:()=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(a,{label:"Unchecked"}),e.jsx(a,{label:"Checked",defaultChecked:!0}),e.jsx(a,{label:"Indeterminate",defaultChecked:"indeterminate"}),e.jsx(a,{label:"Disabled",disabled:!0}),e.jsx(a,{label:"Disabled and checked",disabled:!0,defaultChecked:!0}),e.jsx(a,{label:"Invalid","aria-invalid":!0}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(a,{"aria-label":"Select ENG-2148"}),e.jsx("span",{className:"text-fg-muted text-sm",children:"Without a label (table row)"})]})]})},i=[{id:"eng",name:"Engineering",members:24},{id:"des",name:"Design",members:8},{id:"prd",name:"Product",members:6},{id:"ops",name:"Operations",members:11}],t={render:function(){const[c,o]=b.useState(["eng","des"]),m=c.length===i.length,p=c.length>0&&!m;return e.jsxs(x,{className:"w-80",children:[e.jsxs(C,{children:[e.jsx(k,{children:"Share project"}),e.jsx(g,{children:'Teams that can see "Mobile app v3".'})]}),e.jsxs(f,{className:"flex flex-col gap-3",children:[e.jsx(a,{label:"All teams",checked:m?!0:p?"indeterminate":!1,onCheckedChange:s=>o(s===!0?i.map(d=>d.id):[])}),e.jsxs("fieldset",{className:"ml-6 flex flex-col gap-2.5",children:[e.jsx("legend",{className:"sr-only",children:"Teams"}),i.map(s=>e.jsx(a,{label:s.name,description:`${s.members} members`,checked:c.includes(s.id),onCheckedChange:d=>o(h=>d===!0?[...h,s.id]:h.filter(u=>u!==s.id))},s.id))]})]})]})}},y=["Playground","WithDescription","States","CheckboxGroup"];r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Create sub-issues automatically",
    description: "Split checklist items in the description into sub-issues.",
    defaultChecked: true
  }
}`,...l.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-3">
      <Checkbox label="Unchecked" />
      <Checkbox label="Checked" defaultChecked />
      <Checkbox label="Indeterminate" defaultChecked="indeterminate" />
      <Checkbox label="Disabled" disabled />
      <Checkbox label="Disabled and checked" disabled defaultChecked />
      <Checkbox label="Invalid" aria-invalid />
      <div className="flex items-center gap-2">
        <Checkbox aria-label="Select ENG-2148" />
        <span className="text-fg-muted text-sm">
          Without a label (table row)
        </span>
      </div>
    </div>
}`,...n.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [selected, setSelected] = useState<string[]>(["eng", "des"]);
    const all = selected.length === teams.length;
    const some = selected.length > 0 && !all;
    return <Card className="w-80">
        <CardHeader>
          <CardTitle>Share project</CardTitle>
          <CardDescription>Teams that can see "Mobile app v3".</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Checkbox label="All teams" checked={all ? true : some ? "indeterminate" : false} onCheckedChange={checked => setSelected(checked === true ? teams.map(team => team.id) : [])} />
          <fieldset className="ml-6 flex flex-col gap-2.5">
            <legend className="sr-only">Teams</legend>
            {teams.map(team => <Checkbox key={team.id} label={team.name} description={\`\${team.members} members\`} checked={selected.includes(team.id)} onCheckedChange={checked => setSelected(current => checked === true ? [...current, team.id] : current.filter(id => id !== team.id))} />)}
          </fieldset>
        </CardContent>
      </Card>;
  }
}`,...t.parameters?.docs?.source},description:{story:'A "select all" checkbox driving a group, the common checkbox-group pattern.',...t.parameters?.docs?.description}}};export{t as CheckboxGroup,r as Playground,n as States,l as WithDescription,y as __namedExportsOrder,v as default};
